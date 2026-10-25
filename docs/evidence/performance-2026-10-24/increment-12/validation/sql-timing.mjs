import {createRequire} from 'node:module';
const require=createRequire(`${process.cwd()}/package.json`),pg=require('pg'),query=pg.Client.prototype.query;
pg.Client.prototype.query=function(...args){
 const text=typeof args[0]==='string'?args[0]:'';
 const measured=text==='select rise_private.change_group($1,$2,$3,$4,$5,$6,$7) as revision'&&Array.isArray(args[1])&&args[1][2]==='transfer';
 const started=performance.now(),result=Reflect.apply(query,this,args);
 if(!measured||!result||typeof result.then!=='function')return result;
 return result.then(value=>{process.stderr.write(JSON.stringify({diagnostic:'group_transfer_statement',ms:performance.now()-started,result:'ok'})+'\n');return value;},error=>{process.stderr.write(JSON.stringify({diagnostic:'group_transfer_statement',ms:performance.now()-started,result:error?.code==='57014'?'statement_timeout':'failed'})+'\n');throw error;});
};
