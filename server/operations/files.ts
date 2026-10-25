import { chmod, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
/** Fixed local operational artifacts only; callers never pass user-derived paths. */
export async function writePrivateJson(path:string,value:unknown){
  const directory=dirname(path);await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
  const temporary=`${path}.${randomUUID()}.tmp`;
  const file=await open(temporary,'wx',0o600);
  try{await file.writeFile(JSON.stringify(value)+'\n');await file.sync();await file.close();await rename(temporary,path);}
  catch(error){await file.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
}
export async function readPrivateJson(path:string):Promise<unknown>{
  if((await stat(path)).size>256*1024)throw new Error('operations_file_too_large');
  return JSON.parse(await readFile(path,'utf8'));
}
