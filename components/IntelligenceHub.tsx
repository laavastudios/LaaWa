"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, RefreshCw, MessageCircle, Clock3, AlertTriangle, Search } from "lucide-react";

type Conversation={id:string;name:string|null;phone:string|null;title:string|null;unread_count:number;message_count:number;inbound:number;outbound:number;failed:number;sentiment:"positive"|"negative"|"neutral";responseMinutes:number|null;preview:string};
type Data={configured:boolean;summary:{total:number;open:number;unread:number;inbound:number;outbound:number;avgResponseMinutes:number|null};conversations:Conversation[]};

export default function IntelligenceHub(){
 const [data,setData]=useState<Data|null>(null),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/intelligence",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load intelligence");setData(d)}catch(e){setError(e instanceof Error?e.message:"Could not load intelligence")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return (data?.conversations||[]).filter(c=>(filter==="all"||c.sentiment===filter)&&(!q||`${c.name||""} ${c.phone||""} ${c.preview||""}`.toLowerCase().includes(q)))},[data,query,filter]);
 return <section className="intelligence-hub">
  <div className="intelligence-hero glass"><div className="intelligence-orbit"><span/><span/><BrainCircuit size={38}/></div><div><div className="eyebrow">CONVERSATION INTELLIGENCE</div><h2>Relationship signal, not noise.</h2><p className="muted">Turn real WhatsApp conversations into response, sentiment, and attention signals.</p></div><button className="icon-button" onClick={()=>void load()} title="Refresh"><RefreshCw size={17}/></button></div>
  {error&&<div className="error">{error}</div>}
  <div className="intelligence-stats">{[[MessageCircle,"Conversations",data?.summary.total??0],[AlertTriangle,"Unread",data?.summary.unread??0],[Clock3,"Avg response",data?.summary.avgResponseMinutes==null?"—":`${data.summary.avgResponseMinutes}m`],[BrainCircuit,"Inbound / outbound",`${data?.summary.inbound??0} / ${data?.summary.outbound??0}`]].map(([Icon,label,value])=><div className="card glass" key={String(label)}><Icon size={18}/><span className="label">{label}</span><strong>{value as string|number}</strong></div>)}</div>
  <div className="intelligence-toolbar glass"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search conversations…"/></div><div className="filter-pills">{["all","positive","neutral","negative"].map(v=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{v}</button>)}</div></div>
  <div className="intelligence-list glass"><div className="panel-head"><div><div className="eyebrow">LIVE SIGNALS</div><h3>Conversation health</h3></div><span className="small muted">{loading?"Analyzing…":`${visible.length} shown`}</span></div>
   {loading?<div className="empty"><strong>Reading workspace conversations…</strong><span>No synthetic data is generated.</span></div>:visible.length===0?<div className="empty"><strong>No matching conversations</strong><span>Connect WhatsApp or adjust the filters.</span></div>:<div className="intelligence-rows">{visible.map(c=><article className="intelligence-row" key={c.id}><div className="signal-dot" data-sentiment={c.sentiment}/><div className="signal-main"><strong>{c.name||c.phone||"Unknown contact"}</strong><span>{c.phone||""}</span><p>{c.preview||"No message preview"}</p></div><div className="signal-metrics"><b className={`sentiment ${c.sentiment}`}>{c.sentiment}</b><span>{c.message_count} messages</span><span>{c.responseMinutes==null?"No response pair":`${c.responseMinutes}m avg response`}</span></div>{c.unread_count>0&&<span className="unread-badge">{c.unread_count}</span>}</article>)}</div>}
  </div>
 </section>
}
