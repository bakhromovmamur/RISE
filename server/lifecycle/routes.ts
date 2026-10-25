import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config.ts";
import { Sessions, AuthError } from "../auth/sessions.ts";
import { protectedSessionRoute, sessionInput } from "../auth/routes.ts";
import { exact } from "../../src/contracts/personalCommands.ts";
import { uuid } from "../../src/contracts/accountCommands.ts";
import * as v from "../../src/data/validation.ts";
import { recentAuthentication } from "./repository.ts";
import { readPersonal } from "../personal/repository.ts";
import { createAccountExport } from "../../src/account/export.ts";

function body(value:unknown,fields:Record<string,v.Check>){
  try{exact({accountId:v.string(36),...fields})(value,"lifecycle");const row=v.object(value,"lifecycle");if(!uuid(row.accountId))throw new Error();return row;}
  catch{throw new AuthError(422,"invalid_input");}
}
export function lifecycleRoutes(app:FastifyInstance,config:ServerConfig,sessions:Sessions){
  app.post("/api/v1/account/export",{bodyLimit:2048},protectedSessionRoute(config,async(request,reply)=>{
    const value=body(request.body,{});
    const raw=await sessions.asActor(sessionInput(request,config),true,async(client,actor,metadata)=>{
      if(actor!==value.accountId)throw new AuthError(409,"account_changed");
      await recentAuthentication(client,actor);const view=await readPersonal(client,actor);
      if(!view.records)throw new AuthError(409,"initialize_required");
      let raw:string;
      try{raw=await createAccountExport(actor,view.revision,view.records,metadata.email);}catch(error){if(error instanceof v.StoredDataError)throw new AuthError(422,"export_too_large");throw error;}
      return raw;
    });
    return reply.type("application/json; charset=utf-8").header("Content-Disposition",'attachment; filename="rise-account-export.json"').send(raw);
  },true,"account"));
  app.post("/api/v1/account/deletion",{bodyLimit:2048},protectedSessionRoute(config,async request=>{
    const value=body(request.body,{requestId:v.string(36),revision:v.number(0,Number.MAX_SAFE_INTEGER,true),confirm:v.oneOf("delete-account")});
    if(!uuid(value.requestId))throw new AuthError(422,"invalid_input");
    return sessions.deleteAccount(sessionInput(request,config),String(value.accountId),value.requestId,Number(value.revision));
  },true,"account"));
}
