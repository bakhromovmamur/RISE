import {createContext,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {useApp} from '../context';
import {GroupSession,type GroupState} from './session';
import {captureInvitation} from './invitation';
import {SharedContent} from './content';
import {GroupClient} from './client';
import {SquadContent} from './squads';
import {GroupInvitations} from './invitations';
const empty:GroupState={groups:[],loaded:false,busy:false,error:null,readError:null,pending:null,invalidPending:false,receipt:null};
const noSubscribe=()=>()=>{},getEmpty=()=>empty,getGuest=()=>null;
const GroupsContext=createContext<{session:GroupSession|null;content:SharedContent|null;squads:SquadContent|null;invitations:GroupInvitations|null;client:GroupClient|null;view:GroupState;token:string|null;clearInvitation:()=>void}>({session:null,content:null,squads:null,invitations:null,client:null,view:empty,token:null,clearInvitation:()=>{}});
export const useGroups=()=>useContext(GroupsContext);
export function GroupProvider({invitation,children}:{invitation?:string|null;children:ReactNode}){
 const {workspace,open}=useApp();
 const sync=useSyncExternalStore(workspace?.subscribe??noSubscribe,workspace?.getSyncSnapshot??getGuest);
 const owner=sync&&sync.scope!=='guest'&&sync.scope===workspace?.getAccountIdentity()?.account?.id?sync.scope:null;
 const [session,setSession]=useState<GroupSession|null>(null),[token,setToken]=useState(invitation??null);
 const [content,setContent]=useState<SharedContent|null>(null);
 const [squads,setSquads]=useState<SquadContent|null>(null),[client,setClient]=useState<GroupClient|null>(null);
 const [invitations,setInvitations]=useState<GroupInvitations|null>(null);
 const [intake,setIntake]=useState(0);
 const bound=useRef<string|null>(null),opened=useRef<string|null>(null);
 useEffect(()=>{if(bound.current&&owner!==bound.current){setToken(null);opened.current=null;}if(owner)bound.current=owner;},[owner]);
 useEffect(()=>{if(!workspace)return;const receive=()=>{const next=captureInvitation(location,history);if(next!==null){bound.current=owner;opened.current=null;setToken(next);setIntake(n=>n+1);}};window.addEventListener('hashchange',receive);return()=>window.removeEventListener('hashchange',receive);},[owner,workspace]);
 useEffect(()=>{
  if(!workspace||!owner){setSession(null);setContent(null);setSquads(null);setInvitations(null);setClient(null);return;}
  const client=new GroupClient(owner,workspace.getAccountIdentity),next=new GroupSession(owner,workspace,client);
  const shared=new SharedContent(owner,next,client,()=>workspace.scope===owner&&workspace.getAccountIdentity()?.account?.id===owner);
  const updates=new SquadContent(owner,next,client,()=>workspace.scope===owner&&workspace.getAccountIdentity()?.account?.id===owner);
  const links=new GroupInvitations(owner,next,client,()=>workspace.scope===owner&&workspace.getAccountIdentity()?.account?.id===owner);
  const unregister=workspace.registerSharedPriorities(owner,shared.allowsPriority);
  setSession(next);setContent(shared);setSquads(updates);setInvitations(links);setClient(client);void next.refresh();
  const refresh=()=>{if(!document.hidden)void next.refresh();};
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{unregister();shared.close();updates.close();links.close();next.close();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[workspace,owner]);
 const active=session?.owner===owner?session:null;
 const view=useSyncExternalStore(active?.subscribe??noSubscribe,active?.getSnapshot??getEmpty);
 useEffect(()=>{const target=owner??'guest';if(!workspace||owner&&!active||!token||opened.current===target)return;const timer=setTimeout(()=>{opened.current=target;open({type:'groupJoin'});},0);return()=>clearTimeout(timer);},[active,owner,workspace,token,open,intake]);
 const activeContent=content?.owner===owner?content:null;
 const activeSquads=squads?.owner===owner?squads:null,activeClient=client?.owner===owner?client:null;
 const activeInvitations=invitations?.owner===owner?invitations:null;
 const value=useMemo(()=>({session:active,content:activeContent,squads:activeSquads,invitations:activeInvitations,client:activeClient,view,token,clearInvitation:()=>setToken(null)}),[active,activeContent,activeSquads,activeInvitations,activeClient,view,token]);
 return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}
