import {test}from"node:test";
import assert from"node:assert/strict";
import {createECDH,randomBytes,randomUUID,verify,createPublicKey}from"node:crypto";
import {createRequire}from"node:module";
import webpush from"web-push";
import {pushEndpoint,publicPushAddress,pushSubscription}from"../server/push/endpoint.ts";
import {pushCrypto}from"../server/push/crypto.ts";
import {encryptedPush,pinPushDestination}from"../server/push/transport.ts";
import {pushCapability}from"../src/push/client.ts";
import {parsePushView}from"../src/contracts/push.ts";
const require=createRequire(import.meta.url),ece=require("http_ece") as {decrypt:(body:Buffer,options:object)=>Buffer};
function subscription(){const key=createECDH("prime256v1");key.generateKeys();return{key,value:{endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-${randomUUID()}`,expirationTime:null,keys:{p256dh:key.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}}};}
test("push endpoints accept only reviewed canonical HTTPS provider paths",()=>{
 for(const url of["https://fcm.googleapis.com/fcm/send/token:abc","https://updates.push.services.mozilla.com/wpush/v2/abc_def","https://web.push.apple.com/abc/def"])assert.equal(pushEndpoint(url).href,url);
 for(const url of["http://fcm.googleapis.com/fcm/send/a","https://fcm.googleapis.com:444/fcm/send/a","https://fcm.googleapis.com@127.0.0.1/fcm/send/a","https://u:p@fcm.googleapis.com/fcm/send/a","https://fcm.googleapis.com.evil.invalid/fcm/send/a","https://localhost/fcm/send/a","https://127.1/fcm/send/a","https://[::ffff:127.0.0.1]/fcm/send/a","https://169.254.169.254/latest/meta-data","https://fcm.googleapis.com/fcm/send/a?url=http://localhost","https://fcm.googleapis.com/fcm/send/a#x","https://fcm.googleapis.com/fcm/send/%2e%2e","https://fcm.googleapis.com/other/a"])assert.throws(()=>pushEndpoint(url));
});
test("push connection addresses reject private, reserved, mapped and metadata ranges",()=>{
 for(const ip of["127.0.0.1","0.0.0.0","10.1.2.3","172.16.1.1","192.168.1.1","169.254.169.254","100.64.0.1","192.0.2.1","198.18.0.1","198.51.100.1","203.0.113.1","224.0.0.1","240.0.0.1","::","::1","fc00::1","fe80::1","ff02::1","2001:db8::1","::ffff:8.8.8.8","64:ff9b:1::7f00:1","100:0:0:1::1","3fff::1","4000::1","5f00::1","2606:4700:4700::1111%lo0","not-an-ip"])assert.equal(publicPushAddress(ip),false,ip);
 for(const ip of["8.8.8.8","1.1.1.1","2606:4700:4700::1111"])assert.equal(publicPushAddress(ip),true);
});
test("connection-time DNS validation fails closed on mixed/private answers and pins a checked public address",async()=>{
 const endpoint="https://fcm.googleapis.com/fcm/send/synthetic";
 for(const answers of[[],[{address:"127.0.0.1",family:4}],[{address:"8.8.8.8",family:4},{address:"169.254.169.254",family:4}],[{address:"::ffff:8.8.8.8",family:6}]])await assert.rejects(pinPushDestination(endpoint,async()=>answers));
 const pin=await pinPushDestination(endpoint,async()=>[{address:"8.8.8.8",family:4}]);assert.equal(pin.url.hostname,"fcm.googleapis.com");assert.equal(pin.pinned.address,"8.8.8.8");
});
test("browser subscription keys, expiry and unknown fields are runtime validated",()=>{const s=subscription().value;assert.deepEqual(pushSubscription(s),s);for(const v of[{...s,owner:randomUUID()},{...s,expirationTime:0},{...s,keys:{...s.keys,auth:"0"}},{...s,keys:{...s.keys,p256dh:"A".repeat(87)}},{...s,keys:{...s.keys,secret:"x"}}])assert.throws(()=>pushSubscription(v));});
test("encrypted subscription records bind environment, owner and installation",()=>{const key=randomBytes(32),owner=randomUUID(),device=randomUUID(),c=pushCrypto(key,"environment-a"),s=subscription().value,sealed=c.seal(s,owner,device);assert.ok(!sealed.includes(s.endpoint));assert.deepEqual(c.open(sealed,owner,device),s);for(const [crypto,a,b]of[[c,randomUUID(),device],[c,owner,randomUUID()],[pushCrypto(key,"environment-b"),owner,device],[pushCrypto(randomBytes(32),"environment-a"),owner,device]]as const)assert.throws(()=>crypto.open(sealed,a,b));assert.throws(()=>c.open(sealed.slice(0,-8),owner,device));});
test("real Web Push encryption decrypts for only the synthetic subscriber and VAPID is signed",()=>{
 const s=subscription(),pair=webpush.generateVAPIDKeys(),payload={type:"test",id:randomUUID()},details=encryptedPush(s.value,payload,{...pair,subject:"https://habit.saraftech.com"},120);
 assert.equal(details.headers["Content-Encoding"],"aes128gcm");assert.equal(Number(details.headers.TTL),120);assert.ok(details.body&&!details.body.toString().includes(payload.id));
 const decoded=ece.decrypt(details.body!,{version:"aes128gcm",privateKey:s.key,authSecret:s.value.keys.auth});assert.deepEqual(JSON.parse(decoded.toString()),payload);
 const authorization=String(details.headers.Authorization),jwt=authorization.match(/t=([^,]+)/)?.[1];assert.ok(jwt);const [head,body,sig]=jwt.split(".");const claims=JSON.parse(Buffer.from(body!,"base64url").toString());assert.equal(claims.aud,"https://fcm.googleapis.com");assert.equal(claims.sub,"https://habit.saraftech.com");
 const raw=Buffer.from(pair.publicKey,"base64url"),publicKey=createPublicKey({key:{kty:"EC",crv:"P-256",x:raw.subarray(1,33).toString("base64url"),y:raw.subarray(33).toString("base64url")},format:"jwk"});assert.ok(verify("sha256",Buffer.from(`${head}.${body}`),{key:publicKey,dsaEncoding:"ieee-p1363"},Buffer.from(sig!,"base64url")));
});
test("iPhone/iPad install guidance precedes missing API and Android supports browser mode",()=>{const base={secure:true,notification:true,worker:true,push:true,userAgent:"Android Chrome",touch:1,standalone:false};assert.equal(pushCapability(base),"supported");assert.equal(pushCapability({...base,userAgent:"iPhone",push:false}),"install");assert.equal(pushCapability({...base,userAgent:"Macintosh",touch:5}),"install");assert.equal(pushCapability({...base,userAgent:"iPhone",standalone:true}),"supported");assert.equal(pushCapability({...base,secure:false}),"insecure");assert.equal(pushCapability({...base,push:false}),"unsupported");});
test("push metadata parsers reject endpoint/credential disclosure and unknown status",()=>{const v={configured:true,publicKey:subscription().value.keys.p256dh,installation:null,test:null};assert.deepEqual(parsePushView(v),v);assert.throws(()=>parsePushView({...v,endpoint:"secret"}));assert.throws(()=>parsePushView({...v,test:{id:randomUUID(),status:"delivered",expiresAt:new Date().toISOString()}}));assert.throws(()=>parsePushView({...v,test:{id:randomUUID(),status:["queued"],expiresAt:new Date().toISOString()}}));});
