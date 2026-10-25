import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config.ts";
import { AuthError,type Sessions } from "../auth/sessions.ts";
import { protectedSessionRoute,sessionInput,cookiePolicy } from "../auth/routes.ts";
import { opaque,validOpaque } from "../auth/crypto.ts";
import { pushView,savePush,retirePush,queuePushTest } from "./repository.ts";
import {savePushPlan,readPushPlan,cancelPushPlan} from "./plans.ts";
import {authorizeReminder} from "./receive.ts";
import {authorizeGroupNotice} from './groupReceive.ts';
export function pushRoutes(app:FastifyInstance,config:ServerConfig,sessions:Sessions){
  const names=cookiePolicy(config),name=names.session.replace(/_session$/,"_push");
  app.get('/api/v1/push/group',protectedSessionRoute(config,async req=>{
    if(!['local','test'].includes(config.environment))throw new AuthError(503,'unavailable');
    const matches=(req.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
    const token=matches.length===1?matches[0].slice(name.length+1):null;
    return sessions.asActor(sessionInput(req,config),false,(c,actor)=>authorizeGroupNotice(c,actor,validOpaque(token)?token:null,req.query));
  },false,'push'));
  app.get('/api/v1/push/reminder',protectedSessionRoute(config,async req=>{
    if(!['local','test'].includes(config.environment))throw new AuthError(503,'unavailable');
    const matches=(req.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
    const token=matches.length===1?matches[0].slice(name.length+1):null;
    return sessions.asActor(sessionInput(req,config),false,(c,actor)=>authorizeReminder(c,actor,validOpaque(token)?token:null,req.query));
  },false,'push'));
  app.get('/api/v1/push/plan',protectedSessionRoute(config,async req=>{
    if(!['local','test'].includes(config.environment))throw new AuthError(503,'unavailable');
    const matches=(req.headers.cookie??" ").split(";").map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
    const token=matches.length===1?matches[0].slice(name.length+1):null;
    return sessions.asActor(sessionInput(req,config),false,(c,actor)=>readPushPlan(c,actor,validOpaque(token)?token:null));
  },false,'push'));
  for(const method of ["GET","POST"] as const)app.route({method,url:"/api/v1/push",bodyLimit:8192,handler:protectedSessionRoute(config,async(req,reply)=>{
    const matches=(req.headers.cookie??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
    const existing=matches.length===1?matches[0].slice(name.length+1):null;
    const token=validOpaque(existing)?existing:opaque();
    if(req.method==="POST"&&!validOpaque(existing))throw new AuthError(409,"account_changed");
    const result=await sessions.asActor(sessionInput(req,config),req.method==="POST",async(c,actor)=>{
      if(req.method==="GET")return pushView(c,actor,token,config);
      return savePush(c,actor,token,config,req.body);
    });
    if(req.method==="GET"&&!validOpaque(existing))reply.header("Set-Cookie",`${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${names.secure?"; Secure":""}`);
    return result;
  },method==="POST","push")});
  for(const [suffix,run]of [["disable",retirePush],["test",queuePushTest],["plan",savePushPlan],["cancel-plan",cancelPushPlan]]as const){app.post(`/api/v1/push/${suffix}`,{bodyLimit:32768},protectedSessionRoute(config,async req=>{
    const matches=(req.headers.cookie??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));const token=matches.length===1?matches[0].slice(name.length+1):null;
    if(!validOpaque(token)&&suffix!=="cancel-plan")throw new AuthError(409,"account_changed");
    return sessions.asActor(sessionInput(req,config),true,(c,actor)=>run(c,actor,token??"",config,req.body));
  },true,"push"));}
}
