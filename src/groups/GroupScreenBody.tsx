import type {Screen} from '../context';
import {ServerGroupJoin} from './GroupScreens';
import { FamilyTaskDetail, FamilyTaskForm, GroupCreate, GroupDetail, GroupSettings, GroupsHub, InvitationPreview, ListCreate, SharedListDetail, SquadCompose } from '../Groups';

export default function GroupScreenBody({screen}:{screen:Screen}){
  switch(screen.type){
    case "groups": return <GroupsHub initialKind={screen.kind} />;
    case "group": return <GroupDetail id={screen.id!} initialSection={screen.section} />;
    case "groupCreate": return <GroupCreate kind={screen.id} />;
    case "groupSettings": return <GroupSettings id={screen.id!} />;
    case "invite": return <InvitationPreview id={screen.id!} />;
    case "groupJoin": return <ServerGroupJoin/>;
    case "task": return <FamilyTaskDetail id={screen.id!} groupId={screen.groupId} date={screen.date} />;
    case "taskEdit": return <FamilyTaskForm id={screen.id} groupId={screen.groupId} date={screen.date} />;
    case "sharedList": return <SharedListDetail id={screen.id!} groupId={screen.groupId} />;
    case "listCreate": return <ListCreate groupId={screen.groupId!} />;
    case "squadCompose": return <SquadCompose groupId={screen.groupId!} week={screen.date} />;
    default: return null;
  }
}
