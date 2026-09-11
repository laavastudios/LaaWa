import { NextResponse } from "next/server";
export const runtime = "nodejs";
const spec = {
  openapi:"3.0.3", info:{title:"LaaWa API",version:"1.0.0",description:"Versioned API for messaging, data, realtime, engines, and external integrations."}, servers:[{url:"/api/v1",description:"Current deployment"}], security:[{bearerAuth:[]}], components:{securitySchemes:{bearerAuth:{type:"http",scheme:"bearer"}}},
  paths:{
    "/":{get:{security:[],responses:{"200":{description:"API capabilities"}}}}, "/health":{get:{security:[],responses:{"200":{description:"Healthy"},"503":{description:"Dependency unavailable"}}}}, "/openapi.json":{get:{security:[],responses:{"200":{description:"OpenAPI document"}}}},
    "/engines":{get:{responses:{"200":{description:"Available WhatsApp engines and capabilities"}}}}, "/keys":{get:{responses:{"200":{description:"API keys"}}},post:{responses:{"201":{description:"Created"}}}}, "/keys/{id}":{delete:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Revoked"}}}},
    "/messages":{get:{responses:{"200":{description:"Messages"}}},post:{responses:{"201":{description:"Sent"}}}}, "/conversations":{get:{responses:{"200":{description:"Conversations"}}}}, "/conversations/{id}/messages":{get:{responses:{"200":{description:"Conversation history"}}}}, "/contacts":{get:{responses:{"200":{description:"Contacts"}}}},
    "/events":{get:{description:"Authenticated Server-Sent Events stream.",responses:{"200":{description:"SSE stream",content:{"text/event-stream":{schema:{type:"string"}}}}}}},
    "/integrations":{get:{responses:{"200":{description:"Configured integrations"}}},post:{responses:{"201":{description:"Integration created"}}}},
    "/integrations/{id}":{post:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Connection verified"}}},delete:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Integration deleted"}}}},
    "/integrations/{id}/dispatch":{post:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"Signed webhook delivered"}}}},
  },
};
export async function GET(){return NextResponse.json(spec,{headers:{"cache-control":"public, max-age=300","x-laawa-api-version":"v1"}});}
