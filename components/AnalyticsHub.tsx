"use client";
import { useEffect, useState } from "react";
import { Activity, Bot, BriefcaseBusiness, CheckCircle2, Clock3, MessageSquare, Radio, RefreshCw, Send, Users, XCircle, type LucideIcon } from "lucide-react";

type Data={configured?:boolean;days:number;metrics?:any;daily?:any[];events?:any[];error?:string};
const n=(v:any)=>Number(v||0).toLocaleString();
async function readJson(response:Response){const text=await response.text();if(!text.trim())throw new Error(`Analytics returned an empty response (HTTP ${response.status}).`);try{return JSON.parse(text)}catch{throw new Error(`Analytics returned an invalid response (HTTP ${response.status}).`)}}
export default function AnalyticsHub(){
 const [days,setDays]=useState(30),[data,setData]=useState<Data>({days:30}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch(`/api/analytics?days=${days}`,{cache:"no-store"});const d=await readJson(r);if(!r.ok)throw new Error(d?.error||"Analytics unavailable");setData(d)}catch(e){setError(e instanceof Error?e.message:"Analytics unavailable")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[days]);
 const m=data.metrics||{}; const max=Math.max(1,...(data.daily||[]).map(x=>Number(x.total)||0));
 const cards: [string,string,string,LucideIcon][] = [
  ["Messages",n(m.messages?.total),`${n(m.messages?.inbound)} inbound · ${n(m.messages?.outbound)} outbound`,MessageSquare],
  ["Active chats",n(m.conversations?.active),`${n(m.conversations?.open)} currently open`,Activity],
  ["Contacts",n(m.contacts?.total),`+${n(m.contacts?.created)} in period`,Users],
  ["Won leads",n(m.contacts?.won),`${n(m.contacts?.pipeline_won)} pipeline value`,BriefcaseBusiness],
  ["Campaign sends",n(m.broadcasts?.sent),`${n(m.broadcasts?.recipients)} recipients`,Send],
  ["Automation runs",n(m.automation?.total),`${n(m.automation?.failed)} failed`,Bot],
  ["Jobs",n(m.jobs?.total),`${n(m.jobs?.active)} active`,Clock3],
  ["Accounts",n(m.accounts?.connected),`${n(m.accounts?.total)} total connected`,Radio]
 ];
 return <div className="analytics-wrap">
  <section className="analytics-hero glass"><div className="analytics-orbit"><span/><i/><b/></div><div><div className="eyebrow">OBSERVABILITY / LIVE WORKSPACE DATA</div><h2>Analytics Engine</h2><p>Operational intelligence across messaging, campaigns, automations and infrastructure.</p></div><div className="analytics-controls">{[7,30,90].map(x=><button key={x} className={days===x?"active":""} onClick={()=>setDays(x)}>{x}D</button>)}<button className="icon-btn" onClick={load} aria-label="Refresh"><RefreshCw size={16} className={loading?"spin":""}/></button></div></section>
  {error&&<div className="error">{error}</div>}
  {!loading&&data.error&&!error&&<div className="error">{data.error}</div>}
  {loading&&!data.metrics&&<div className="empty glass"><strong>Loading live analytics</strong><span>Querying the workspace data…</span></div>}
  {!loading&&!data.configured&&<div className="empty glass"><strong>Database not configured</strong><span>Connect PostgreSQL to see live workspace analytics.</span></div>}
  {!loading&&data.configured&&data.metrics&&<>
   <div className="analytics-cards">{cards.map(([label,value,sub,Icon],i)=><article className="analytics-card glass" key={label} style={{animationDelay:`${i*45}ms`}}><div className="metric-icon"><Icon size={17}/></div><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>)}</div>
   <div className="analytics-grid"><section className="panel glass"><div className="panel-head"><div><div className="eyebrow">MESSAGE FLOW</div><h3>Volume over time</h3></div><span className="badge good">{days} days</span></div><div className="bars">{(data.daily||[]).map(d=><div className="bar-col" key={d.day} title={`${d.day}: ${n(d.total)} messages`}><div className="bar" style={{height:`${Math.max(5,(Number(d.total)||0)/max*100)}%`}}/><small>{String(d.day).slice(5)}</small></div>)}</div></section>
   <section className="panel glass health"><div className="panel-head"><div><div className="eyebrow">SYSTEM HEALTH</div><h3>Execution status</h3></div></div><div className="health-row"><CheckCircle2/><div><strong>{n(m.jobs?.completed)}</strong><span>jobs completed</span></div></div><div className="health-row"><XCircle/><div><strong>{n(m.jobs?.failed)}</strong><span>jobs failed</span></div></div><div className="health-row"><Bot/><div><strong>{n(m.automation?.completed)}</strong><span>automation runs completed</span></div></div><div className="health-row"><Radio/><div><strong>{n(m.accounts?.connected)} / {n(m.accounts?.total)}</strong><span>WhatsApp accounts connected</span></div></div></section></div>
   <section className="panel glass"><div className="panel-head"><div><div className="eyebrow">AUDIT STREAM</div><h3>Recent operational events</h3></div><span className="small muted">Latest 12</span></div><div className="event-list">{(data.events||[]).map(e=><div className="event" key={String(e.id)}><span className="event-dot"/><div><strong>{e.action}</strong><small>{e.resource_type||"workspace"}{e.resource_id?` · ${e.resource_id.slice(0,8)}`:""}</small></div><time>{new Date(e.created_at).toLocaleString()}</time></div>)}{!(data.events||[]).length&&<div className="empty"><strong>No audit events yet</strong><span>Operational events will appear here as the workspace is used.</span></div>}</div></section>
  </>}
 </div>
}
