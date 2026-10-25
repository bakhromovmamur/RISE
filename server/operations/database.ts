import pg from 'pg';
import { queueSummary } from './monitor.ts';
export function operationsDatabase(env:NodeJS.ProcessEnv,environment:'local'|'test'){
  if(Object.keys(env).some(key=>!['DEPLOY_ENV','INSTALLATION_ID','DATABASE_OPS_URL'].includes(key))||env.DEPLOY_ENV!==environment||! /^[0-9a-f-]{36}$/.test(env.INSTALLATION_ID??''))throw new Error('invalid_operations_configuration');
  const url=new URL(env.DATABASE_OPS_URL??'');
  if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!==(environment==='local'?'55322':'55422')||url.username!=='rise_ops_login'||url.pathname!=='/postgres'||url.search||url.hash||! /^[a-f0-9]{64}$/.test(url.password))throw new Error('invalid_operations_connection');
  const pool=new pg.Pool({connectionString:url.href,max:1,connectionTimeoutMillis:3000,statement_timeout:3000,query_timeout:4000,ssl:false});
  // Idle socket errors must not crash the watcher; the next probe reports unavailable.
  pool.on('error',()=>{});
  return {close:()=>pool.end(),sample:async()=>{
    const {rows:[r]}=await pool.query(`select current_user='rise_ops_login' as expected,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,
      pg_has_role(current_user,'rise_ops','member') as member,
      (select count(*) from pg_auth_members where member=(select oid from pg_roles where rolname=current_user))::integer as memberships
      from pg_roles where rolname=current_user`);
    if(!r?.expected||!r.member||r.memberships!==1||r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolreplication)throw new Error('unsafe_operations_role');
    const {rows}=await pool.query('select rise_private.operations_snapshot($1,$2) as sample',[environment,env.INSTALLATION_ID]);
    return queueSummary(rows[0].sample);
  }};
}
