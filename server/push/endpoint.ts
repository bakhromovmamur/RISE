import { ECDH } from "node:crypto";
import ipaddr from "ipaddr.js";
import { pushObject, pushOnly, type PushSubscriptionInput } from "../../src/contracts/push.ts";
/** Deliberate provider allowlist. New hosts require review, never an arbitrary URL fallback. */
export function pushEndpoint(value:unknown):URL{
  if(typeof value!=="string"||value.length>4096)throw new Error("invalid_push_endpoint");
  const u=new URL(value);
  const path=u.hostname==="fcm.googleapis.com"?/^\/fcm\/send\/[\w:.-]+$/:u.hostname==="updates.push.services.mozilla.com"?/^\/wpush\/v2\/[\w-]+$/:u.hostname==="web.push.apple.com"?/^\/[\w/-]+$/:null;
  if(u.protocol!=="https:"||u.port||u.username||u.password||u.hash||u.search||u.href!==value||!path?.test(u.pathname))throw new Error("invalid_push_endpoint");
  return u;
}
export function publicPushAddress(value:string):boolean{
  try{if(value.includes("%"))return false;const address=ipaddr.parse(value);if(address.range()!=="unicast")return false;
    // IPv6 unicast classification alone includes unallocated/dummy space. Only
    // global unicast can be a provider destination; special/translated ranges
    // are rejected above, including mapped IPv4 and the NAT64 local-use block.
    return address.kind()==="ipv4"||(address as ipaddr.IPv6).match(ipaddr.IPv6.parse("2000::"),3);
  }catch{return false;}
}
export function pushSubscription(value:unknown):PushSubscriptionInput{
  if(!pushObject(value)||!pushOnly(value,["endpoint","expirationTime","keys"])||!(value.expirationTime===null||Number.isSafeInteger(value.expirationTime)&&Number(value.expirationTime)>Date.now()&&Number(value.expirationTime)<8640000000000000)||!pushObject(value.keys)||!pushOnly(value.keys,["p256dh","auth"]))throw new Error("invalid_subscription");
  pushEndpoint(value.endpoint);
  const p=value.keys.p256dh,a=value.keys.auth;
  if(typeof p!=="string"||!/^[\w-]{87}$/.test(p)||typeof a!=="string"||!/^[\w-]{22}$/.test(a)||Buffer.from(p,"base64url").toString("base64url")!==p||Buffer.from(a,"base64url").toString("base64url")!==a)throw new Error("invalid_subscription");
  const point=Buffer.from(p,"base64url");if(point[0]!==4)throw new Error("invalid_subscription");
  ECDH.convertKey(point,"prime256v1");
  return {endpoint:String(value.endpoint),expirationTime:value.expirationTime as number|null,keys:{p256dh:p,auth:a}};
}
