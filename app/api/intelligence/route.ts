import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { id:string; name:string|null; phone:string|null; title:string|null; last_message_at:string|null; unread_count:number; message_count:number; inbound:number; outbound:number; failed:number; first_at:string|null; last_at:string|null };

function sentiment(text:string) {
  const value=text.toLowerCase();
  const positive=["thanks","thank you","great","awesome","love","perfect","happy","good","yes","amazing","helpful"];
  const negative=["angry","bad","hate","terrible","awful","refund","complaint","problem","issue","not working","failed","disappointed"];
  const score=positive.reduce((n,w)=>n+(value.includes(w)?1:0),0)-negative.reduce((n,w)=>n+(value.includes(w)?1:0),0);
  return score>0?"positive":score<0?"negative":"neutral";
}

export async function GET(){
  const c=await cookies();
  if(!verifySession(c.get("laawa_session")?.value)) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!isDatabaseConfigured()) return NextResponse.json({configured:false,conversations:[]});
  const workspace=await query<{id:string}>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  const wid=workspace.rows[0]?.id;
  if(!wid) return NextResponse.json({configured:true,conversations:[],summary:{total:0,open:0,unread:0,avgResponseMinutes:null}});
  const rows=await query<Row>(`SELECT c.id,c.title,coalesce(ct.name,ct.push_name) name,ct.phone,c.last_message_at,c.unread_count,count(m.id)::int message_count,count(m.id) FILTER(WHERE m.direction='inbound')::int inbound,count(m.id) FILTER(WHERE m.direction='outbound')::int outbound,count(m.id) FILTER(WHERE m.status='failed')::int failed,min(m.created_at) first_at,max(m.created_at) last_at FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN messages m ON m.conversation_id=c.id WHERE c.workspace_id=$1 AND c.chat_type='individual' GROUP BY c.id,ct.id ORDER BY c.last_message_at DESC NULLS LAST LIMIT 100`,[wid]);
  const ids=rows.rows.map(r=>r.id);
  const messages=ids.length?await query<{conversation_id:string;body:string;direction:string;created_at:string}>(`SELECT conversation_id,body,direction,created_at FROM messages WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at DESC`,[ids]):{rows:[]};
  const by=new Map<string,typeof messages.rows>(); for(const m of messages.rows){const list=by.get(m.conversation_id)||[];if(list.length<30)list.push(m);by.set(m.conversation_id,list)}
  let totalInbound=0,totalOutbound=0,totalUnread=0,responseTotal=0,responsePairs=0;
  const conversations=rows.rows.map(r=>{const ms=by.get(r.id)||[];const text=ms.map(m=>m.body||"").join(" ");let latestInbound:Date|null=null;let response=0,pairs=0;for(const m of [...ms].reverse()){if(m.direction==='inbound')latestInbound=new Date(m.created_at);else if(m.direction==='outbound'&&latestInbound){const diff=new Date(m.created_at).getTime()-latestInbound.getTime();if(diff>=0&&diff<7*86400000){response+=diff;pairs++;latestInbound=null}}}totalInbound+=r.inbound;totalOutbound+=r.outbound;totalUnread+=r.unread_count||0;responseTotal+=response;responsePairs+=pairs;return {...r,sentiment:sentiment(text),responseMinutes:pairs?Math.round(response/pairs/60000):null,preview:ms[0]?.body||""}});
  return NextResponse.json({configured:true,summary:{total:conversations.length,open:rows.rows.filter(r=>r.last_message_at).length,unread:totalUnread,inbound:totalInbound,outbound:totalOutbound,avgResponseMinutes:responsePairs?Math.round(responseTotal/responsePairs/60000):null},conversations});
}
