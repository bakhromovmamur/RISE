import type {FastifyInstance} from 'fastify';
import type {ServerConfig} from '../config.ts';
import {AuthError,type Sessions} from '../auth/sessions.ts';
import {protectedSessionRoute,sessionInput} from '../auth/routes.ts';
import {applyGroup,groupOutcome,previewGroup,readGroups,readGroupReceipt} from './repository.ts';
import {readSharedContent} from './content.ts';
import {previewSquad,readSquad} from './squads.ts';
import {readGroupInvitations} from './invitations.ts';
import {exportGroup} from './export.ts';
export function groupRoutes(app:FastifyInstance,config:ServerConfig,sessions:Sessions){
 const local=()=>{if(config.environment!=='local'&&config.environment!=='test')throw new AuthError(503,'unavailable');};
 app.get('/api/v1/groups',protectedSessionRoute(config,async request=>{local();return sessions.asActor(sessionInput(request,config),false,readGroups);},false,'groups'));
 app.post<{Params:{groupId:string}}>('/api/v1/groups/:groupId/export',{bodyLimit:1024},protectedSessionRoute(config,async(request,reply)=>{
  local();const {groupId}=request.params as {groupId:string};
  const raw=await sessions.asActor(sessionInput(request,config),true,(c,actor)=>exportGroup(c,actor,groupId,request.body));
  return reply.type('application/json; charset=utf-8').header('Content-Disposition','attachment; filename="rise-group-archive.json"').send(raw);
 },true,'groups'));
 app.get<{Params:{groupId:string};Querystring:Record<string,unknown>}>('/api/v1/groups/:groupId/invitations',protectedSessionRoute(config,async request=>{
  local();const params=request.params as {groupId:string},query=request.query as Record<string,unknown>;if(Object.hasOwn(query,'groupId'))throw new AuthError(422,'invalid_input');
  return sessions.asActor(sessionInput(request,config),false,(c,actor)=>readGroupInvitations(c,actor,{...query,groupId:params.groupId,
   ...(typeof query.revision==='string'&&/^[1-9]\d{0,9}$/.test(query.revision)?{revision:Number(query.revision)}:{})}));
 },false,'groups'));
 app.get<{Params:{groupId:string};Querystring:Record<string,unknown>}>('/api/v1/groups/:groupId/content',protectedSessionRoute(config,async request=>{
  local();const params=request.params as {groupId:string},query=request.query as Record<string,unknown>;
  // Query input is still validated exactly by the content contract; unknown
  // fields and repeated query parameters cannot select an alternate projection.
  if(Object.hasOwn(query,'groupId'))throw new AuthError(422,'invalid_input');
  return sessions.asActor(sessionInput(request,config),false,(c,actor)=>readSharedContent(c,actor,{...query,groupId:params.groupId,...(typeof query.revision==='string'&&/^[1-9]\d{0,9}$/.test(query.revision)?{revision:Number(query.revision)}:{})}));
 },false,'groups'));
 app.post('/api/v1/groups/commands',{bodyLimit:8192},protectedSessionRoute(config,async request=>{
  local();return groupOutcome(await sessions.asActor(sessionInput(request,config),true,(c,actor)=>applyGroup(c,config,actor,request.body)));
 },true,'groups'));
 app.post('/api/v1/groups/invitations/preview',{bodyLimit:1024},protectedSessionRoute(config,async request=>{
  local();return groupOutcome(await sessions.asActor(sessionInput(request,config),true,(c,actor)=>previewGroup(c,actor,request.body)));
 },true,'groups'));
 app.post('/api/v1/groups/receipt',{bodyLimit:1024},protectedSessionRoute(config,async request=>{
  local();return sessions.asActor(sessionInput(request,config),true,(c,actor)=>readGroupReceipt(c,actor,request.body));
 },true,'groups'));
 app.post('/api/v1/squads/preview',{bodyLimit:8192},protectedSessionRoute(config,async request=>{
  local();return groupOutcome(await sessions.asActor(sessionInput(request,config),true,(c,actor)=>previewSquad(c,actor,request.body)));
 },true,'groups'));
 app.get<{Params:{groupId:string};Querystring:Record<string,unknown>}>('/api/v1/squads/:groupId',protectedSessionRoute(config,async request=>{
  local();const params=request.params as {groupId:string},query=request.query as Record<string,unknown>;
  if(Object.hasOwn(query,'groupId'))throw new AuthError(422,'invalid_input');
  return sessions.asActor(sessionInput(request,config),false,(c,actor)=>readSquad(c,actor,{...query,groupId:params.groupId,
   ...(typeof query.revision==='string'&&/^[1-9]\d{0,9}$/.test(query.revision)?{revision:Number(query.revision)}:{})}));
 },false,'groups'));
}
