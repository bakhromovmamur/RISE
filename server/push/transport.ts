import { lookup } from "node:dns/promises";
import { request } from "node:https";
import webpush, {type RequestDetails} from "web-push";
import type { PushSubscriptionInput } from "../../src/contracts/push.ts";
import { publicPushAddress,pushEndpoint } from "./endpoint.ts";
export interface Vapid {publicKey:string;privateKey:string;subject:string}
export function encryptedPush(subscription:PushSubscriptionInput,payload:object,vapid:Vapid,ttl:number):RequestDetails{
  pushEndpoint(subscription.endpoint);
  return webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:Math.max(1,Math.min(120,Math.floor(ttl))),urgency:"normal",contentEncoding:"aes128gcm",vapidDetails:vapid});
}
/** Resolve, reject every non-public answer and pin the TLS connection to that
 * result. No proxy, redirects, pooled sockets, arbitrary host or response body. */
export async function pinPushDestination(endpoint:string,resolve:(host:string)=>Promise<{address:string;family:number}[]>=host=>lookup(host,{all:true,verbatim:true})){
  const url=pushEndpoint(endpoint);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const answers=await Promise.race([resolve(url.hostname),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("push_dns_failed")),3000);})]).finally(()=>clearTimeout(timer));
  if(!answers.length||answers.some(a=>!publicPushAddress(a.address)))throw new Error("push_destination_blocked");
  return {url,pinned:answers[0]};
}
export async function sendEncryptedPush(details:RequestDetails):Promise<number>{
  const {url,pinned}=await pinPushDestination(details.endpoint);
  return new Promise((resolve,reject)=>{
    const req=request(url,{method:"POST",headers:details.headers,agent:false,minVersion:"TLSv1.2",signal:AbortSignal.timeout(5000),servername:url.hostname,lookup:(_hostname,options,callback)=>{if(options.all)callback(null,[pinned]);else callback(null,pinned.address,pinned.family);}},res=>{
      let bytes=0;res.on("data",(part:Buffer)=>{bytes+=part.length;if(bytes>16384)req.destroy(new Error("push_response_too_large"));});
      res.on("end",()=>resolve(res.statusCode??0));res.on("error",()=>reject(new Error("push_transport_failed")));
    });
    req.setTimeout(5000,()=>req.destroy(new Error("push_timeout")));req.on("error",()=>reject(new Error("push_transport_failed")));
    if(details.body)req.write(details.body);req.end();
  });
}
