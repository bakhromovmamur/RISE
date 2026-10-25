import { createCipheriv,createDecipheriv,createHmac,randomBytes } from "node:crypto";
/** Dedicated key, independent of auth/session encryption. Ciphertext binds environment, owner and installation. */
export function pushCrypto(key:Buffer,environmentId:string){
  if(key.length!==32)throw new Error("invalid_push_key");
  return {
    digest:(value:string)=>createHmac("sha256",key).update(value).digest(),
    seal(value:unknown,owner:string,device:string){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key,iv);c.setAAD(Buffer.from(`${environmentId}:${owner}:${device}`));const body=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return ["v1",iv.toString("base64url"),c.getAuthTag().toString("base64url"),body.toString("base64url")].join(".");},
    open(value:string,owner:string,device:string):unknown{const [v,iv,tag,body,extra]=value.split(".");if(v!=="v1"||extra||!iv||!tag||!body||value.length>12000)throw new Error("invalid_push_cipher");const d=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64url"));d.setAAD(Buffer.from(`${environmentId}:${owner}:${device}`));d.setAuthTag(Buffer.from(tag,"base64url"));return JSON.parse(Buffer.concat([d.update(Buffer.from(body,"base64url")),d.final()]).toString());}
  };
}
