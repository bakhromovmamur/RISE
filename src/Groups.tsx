import {TaskRow} from "./groups/TodayGroups";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Bell, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, Heart, Home, ListChecks, LockKeyhole, Pencil, Plus, Settings2, Share2, Sprout, Trash2, UserPlus, Users, X } from "lucide-react";
import { useApp } from "./context";
import { Button, GroupRow, SectionTitle, Toggle } from "./components";
import { LifeIntro, PreviewLabel, PrivacyNote, useLifeDraft, useText } from "./LifeUI";
import { availableGroups, completeTask, createGroup, taskOccurs, type FamilyTask, type LocalGroup, type SharedList, type SquadUpdate } from "./lifeModel";
import { addDays, today, weekStart } from "./model";
import { weeklyHabits, weekGoalMovement } from "./developmentModel";
import { weeklyPrayers } from "./prayerModel";
import { weekLabel } from "./Development";
import {ServerGroupsHub,ServerGroupCreate,ServerGroupDetail,ServerGroupSettings,ServerGroupInvite} from './groups/GroupScreens';
import {SharedFamilyPlan,ServerTaskForm,ServerTaskDetail,ServerListCreate,ServerListDetail} from './groups/SharedScreens';
import {ServerSquadFeed,ServerSquadCompose} from './groups/SquadScreens';

export function GroupsHub(props:{initialKind?:'family'|'squad'}){return useApp().workspace?<ServerGroupsHub {...props}/>:<LocalGroupsHub {...props}/>;}
export function GroupCreate(props:{kind?:string}){return useApp().workspace?<ServerGroupCreate {...props}/>:<LocalGroupCreate {...props}/>;}
export function GroupDetail(props:{id:string;initialSection?:'tasks'|'lists'}){return useApp().workspace?<ServerGroupDetail id={props.id} renderFamily={group=><SharedFamilyPlan key={group.id} group={group} initialSection={props.initialSection}/>} renderSquad={group=><ServerSquadFeed key={group.id} group={group}/>}/>:<LocalGroupDetail {...props}/>;}
export function SquadCompose(props:{groupId:string;week?:string}){return useApp().workspace?<ServerSquadCompose {...props}/>:<LocalSquadCompose {...props}/>;}
export function GroupSettings(props:{id:string}){return useApp().workspace?<ServerGroupSettings {...props}/>:<LocalGroupSettings {...props}/>;}
export function InvitationPreview(props:{id:string}){return useApp().workspace?<ServerGroupInvite {...props}/>:<LocalInvitationPreview {...props}/>;}

function Avatar({ name }: { name: string }) {
  return <span className="member-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>;
}
function GroupMissing() {
  const t = useText();
  const { open } = useApp();
  return <div className="life-screen"><LifeIntro title={t("This space is closed.", "Bu joy yopilgan.")} text={t("Your personal progress is still here. Return to Your people to manage your groups.", "Shaxsiy natijalaringiz saqlanadi. Guruhlarni boshqarish uchun Yaqinlaringiz bo‘limiga qayting.")} /><Button onClick={() => open({ type: "groups" })}>{t("Your people", "Yaqinlaringiz")}</Button></div>;
}
function LocalGroupsHub({ initialKind = "family" }: { initialKind?: "family" | "squad" }) {
  const t = useText();
  const { state, open, setState } = useApp();
  const [kind, setKind] = useState<"family" | "squad">(initialKind);
  const groups = availableGroups(state).filter((g) => g.kind === kind);
  const closed = state.life.groups.filter((g) => g.kind === kind && (g.archived || g.left));
  return <div className="life-screen">
    <PreviewLabel>{t("Local demo · all other members are fictional", "Mahalliy namuna · boshqa a’zolar xayoliy")}</PreviewLabel>
    <LifeIntro title={t("Your people. Your pace.", "Yaqinlaringiz. O‘z maromingiz.")}
      text={t("Share a little of the journey. Keep the rest just for you.", "Yo‘lingizning bir qismini ulashing. Qolganini o‘zingiz uchun saqlang.")} />
    <div className="segmented life-segments"><button aria-pressed={kind === "family"} className={kind === "family" ? "selected" : ""} onClick={() => setKind("family")}><Home size={17} />{t("Family", "Oila")}</button><button aria-pressed={kind === "squad"} className={kind === "squad" ? "selected" : ""} onClick={() => setKind("squad")}><Users size={17} />{t("Squads", "Guruhlar")}</button></div>
    <p className="section-description">{kind === "family" ? t("The everyday things, a little easier together.", "Kundalik ishlarni birga bajarish osonroq.") : t("Small circles. Encouragement without comparison.", "Kichik davra. Taqqoslashsiz qo‘llab-quvvatlash.")}</p>
    {groups.map((g) => <button className="people-group" key={g.id} onClick={() => open({ type: "group", id: g.id })}>
      <span className="people-group-title">{g.kind === "family" ? <Home size={23} /> : <Users size={23} />}<strong>{g.name}</strong><ChevronRight size={19} /></span>
      <span className="people-group-copy">{g.kind === "family" ? t("Tasks, plans, and shared lists", "Vazifalar, rejalar va umumiy ro‘yxatlar") : t("A weekly moment to share", "Haftalik yangiliklarni ulashish")}</span>
      <span className="people-group-members"><span className="avatar-stack">{g.members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} />)}</span><small>{t("{0} members · private", "{0} a’zo · shaxsiy", [g.members.length])}</small></span>
    </button>)}
    {!groups.length && <div className="people-empty">{kind === "family" ? <Home size={35} /> : <Users size={35} />}<h2>{kind === "family" ? t("A space for your family.", "Oilangiz uchun joy.") : t("Your circle starts here.", "Davrangiz shu yerdan boshlanadi.")}</h2><p>{t("Create a group to try the experience. Nothing is sent to anyone.", "Sinab ko‘rish uchun guruh yarating. Hech kimga hech narsa yuborilmaydi.")}</p></div>}
    <Button variant="secondary" className="wide" onClick={() => open({ type: "groupCreate", id: kind })}><Plus size={18} />{kind === "family" ? t("Create a family space", "Oilaviy joy yaratish") : t("Create a private squad", "Shaxsiy guruh yaratish")}</Button>
    <PrivacyNote>{t("Joining a group never shares your prayer records, private pause, habits, or saved work notes.", "Guruhga qo‘shilish namoz qaydlari, shaxsiy tanaffus, odatlar yoki ish qaydlarini ulashmaydi.")}</PrivacyNote>
    {closed.length > 0 && <details className="done-group"><summary>{t("Archived & left groups", "Arxivlangan va tark etilgan guruhlar")} · {closed.length}</summary>{closed.map((g) => <div className="closed-group" key={g.id}><span>{g.name}</span>{g.archived && <button className="text-button" onClick={() => setState((s) => ({ ...s, life: { ...s.life, groups: s.life.groups.map((x) => x.id === g.id ? { ...x, archived: false } : x) } }))}>{t("Restore", "Tiklash")}</button>}{g.left && <small>{t("Left · a new invitation would be needed", "Tark etilgan · yangi taklif kerak bo‘ladi")}</small>}</div>)}</details>}
  </div>;
}
function LocalGroupCreate({ kind = "family" }: { kind?: string }) {
  const t = useText();
  const { state, setState, open, back } = useApp();
  const [draft, setDraft, clear] = useLifeDraft(`group-create:${kind}`, () => ({ name: "", kind: kind === "squad" ? "squad" as const : "family" as const }));
  return <form className="life-screen" onSubmit={(e) => { e.preventDefault(); if (!draft.name.trim()) return; const next = createGroup(state, draft.kind, draft.name); setState(next); clear(); back(); open({ type: "group", id: next.life.groups.at(-1)!.id }); }}>
    <PreviewLabel />
    <LifeIntro title={draft.kind === "family" ? t("A home for little plans.", "Kichik rejalar uchun joy.") : t("Grow at your own pace.", "O‘z maromingizda o‘sing.")}
      text={t("Name your private space. You can add fictional members using the invitation preview.", "Shaxsiy joyingizga nom bering. Taklif namunasi orqali xayoliy a’zolar qo‘shishingiz mumkin.")} />
    <label className="field">{t("Group name", "Guruh nomi")}<input required maxLength={80} value={draft.name} placeholder={draft.kind === "family" ? t("Our family", "Bizning oilamiz") : t("Small steps together", "Birga kichik qadamlar")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
    <PrivacyNote>{t("Membership and invitations are simulated on this browser.", "A’zolik va takliflar shu brauzerda namuna sifatida ishlaydi.")}</PrivacyNote>
    <Button type="submit" className="wide" disabled={!draft.name.trim()}>{t("Create local group", "Mahalliy guruh yaratish")}<ArrowRight size={18} /></Button>
  </form>;
}

function LocalGroupDetail({ id, initialSection = "tasks" }: { id: string; initialSection?: "tasks" | "lists" }) {
  const t = useText();
  const { state, open } = useApp();
  const group = availableGroups(state).find((g) => g.id === id);
  const [date, setDate] = useState(today(state));
  const [section, setSection] = useState(initialSection);
  if (!group) return <GroupMissing />;
  const tasks = state.life.tasks.filter((task) => task.groupId === id && taskOccurs(task, date));
  const lists = state.life.lists.filter((list) => list.groupId === id && !list.archived);
  return <div className="life-screen">
    <PreviewLabel>{t("Private group preview · fictional members", "Shaxsiy guruh namunasi · xayoliy a’zolar")}</PreviewLabel>
    <div className="group-page-heading"><div><h1>{group.name}</h1><p><LockKeyhole size={13} />{t("{0} members · Asia/Tashkent", "{0} a’zo · Asia/Tashkent", [group.members.length])}</p></div><button className="icon-button" aria-label={t("Group settings", "Guruh sozlamalari")} onClick={() => open({ type: "groupSettings", id })}><Settings2 size={21} /></button></div>
    <div className="group-member-strip">{group.members.map((m) => <span key={m.id}><Avatar name={m.name} /><small>{m.id === "self" ? t("You", "Siz") : m.name}</small></span>)}<button aria-label={t("Invite a member", "A’zo taklif qilish")} onClick={() => open({ type: "invite", id })}><span className="member-avatar add-member"><Plus size={18} /></span><small>{t("Invite", "Taklif")}</small></button></div>
    {group.kind === "family" ? <>
      <div className="segmented life-segments"><button className={section === "tasks" ? "selected" : ""} aria-pressed={section === "tasks"} onClick={() => setSection("tasks")}><CheckCheck size={17} />{t("Tasks", "Vazifalar")}</button><button className={section === "lists" ? "selected" : ""} aria-pressed={section === "lists"} onClick={() => setSection("lists")}><ClipboardList size={17} />{t("Lists", "Ro‘yxatlar")}</button></div>
      {section === "tasks" ? <>
        <div className="shared-week family-date"><button className="icon-button" aria-label={t("Previous task date", "Oldingi sana")} onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={19} /></button><div><strong>{date === today(state) ? t("Today", "Bugun") : t.date(date)}</strong><span>{date === today(state) ? t.date(date) : t("Family plan", "Oilaviy reja")}</span></div><button className="icon-button" aria-label={t("Next task date", "Keyingi sana")} onClick={() => setDate(addDays(date, 1))}><ChevronRight size={19} /></button></div>
        <SectionTitle title={t("A plan we share", "Umumiy rejamiz")}><button className="text-button" onClick={() => open({ type: "taskEdit", groupId: id, date })}><Plus size={16} />{t("Add task", "Vazifa qo‘shish")}</button></SectionTitle>
        {tasks.filter((task) => !task.completions[date]).map((task) => <TaskRow key={task.id} task={task} date={date} />)}
        {!tasks.length && <div className="people-empty"><ListChecks size={30} /><h2>{t("A little breathing room.", "Biroz erkin vaqt.")}</h2><p>{t("Add a task for this day. Everyone can help.", "Shu kunga vazifa qo‘shing. Hamma yordam bera oladi.")}</p><Button variant="secondary" onClick={() => open({ type: "taskEdit", groupId: id, date })}>{t("Add a family task", "Oilaviy vazifa qo‘shish")}</Button></div>}
        {tasks.some((task) => task.completions[date]) && <details className="done-group" open><summary>{t("Done together", "Birga bajarildi")}</summary>{tasks.filter((task) => task.completions[date]).map((task) => <TaskRow key={task.id} task={task} date={date} />)}</details>}
        <details className="done-group"><summary>{t("All scheduled tasks", "Barcha rejalangan vazifalar")}</summary>{state.life.tasks.filter((task) => task.groupId === id && !task.archived).map((task) => <GroupRow key={task.id} title={task.title} detail={`${t.date(task.date)}${task.weekdays.length ? ` · ${t("Repeats weekly", "Haftalik takrorlanadi")}` : ""}`} onClick={() => open({ type: "task", id: task.id, date: task.weekdays.length ? date : task.date })} />)}</details>
        {state.life.tasks.some((task) => task.groupId === id && task.archived) && <details className="done-group"><summary>{t("Archived tasks", "Arxivlangan vazifalar")}</summary>{state.life.tasks.filter((task) => task.groupId === id && task.archived).map((task) => <GroupRow key={task.id} title={task.title} onClick={() => open({ type: "task", id: task.id, date: task.date })} />)}</details>}
      </> : <><SectionTitle title={t("Lists for everyday life", "Kundalik ro‘yxatlar")} /><div className="group">{lists.map((list) => <GroupRow key={list.id} icon={<ClipboardList size={22} />} title={list.name} detail={`${list.items.filter((i) => i.checked).length}/${list.items.length} ${t("checked", "belgilangan")}`} onClick={() => open({ type: "sharedList", id: list.id })} />)}</div>{!lists.length && <p className="section-description">{t("A shopping list, an outing, or a few things to remember.", "Xaridlar, sayohat yoki esda tutish kerak bo‘lgan ishlar.")}</p>}<Button className="wide" variant="secondary" onClick={() => open({ type: "listCreate", groupId: id })}><Plus size={18} />{t("Create a shared list", "Umumiy ro‘yxat yaratish")}</Button>
        {state.life.lists.some((l) => l.groupId === id && l.archived) && <details className="done-group"><summary>{t("Archived lists", "Arxivlangan ro‘yxatlar")}</summary>{state.life.lists.filter((l) => l.groupId === id && l.archived).map((l) => <GroupRow key={l.id} title={l.name} onClick={() => open({ type: "sharedList", id: l.id })} />)}</details>}
      </>}
      <PrivacyNote>{t("Shared tasks don’t add personal XP or reveal private habits.", "Umumiy vazifalar shaxsiy XP bermaydi va shaxsiy odatlarni ko‘rsatmaydi.")}</PrivacyNote>
    </> : <SquadFeed group={group} />}
  </div>;
}

export function FamilyTaskForm(props:{id?:string;groupId?:string;date?:string}){return useApp().workspace?<ServerTaskForm {...props}/>:<LocalFamilyTaskForm {...props}/>;}
function LocalFamilyTaskForm({ id, groupId, date }: { id?: string; groupId?: string; date?: string }) {
  const t = useText();
  const { state, setState, back, toast } = useApp();
  const existing = state.life.tasks.find((task) => task.id === id);
  const group = availableGroups(state).find((g) => g.id === (existing?.groupId ?? groupId));
  const [draft, setDraft, clear] = useLifeDraft(`task:${id ?? groupId ?? "new"}`, () => ({
    title: existing?.title ?? "", notes: existing?.notes ?? "", assignee: existing?.assignee ?? "self",
    date: existing?.date ?? date ?? today(state), time: existing?.time ?? "", weekdays: existing?.weekdays ?? [] as number[],
  }));
  if (!group) return <GroupMissing />;
  const save = () => {
    if (!draft.title.trim() || !draft.date) return;
    setState((s) => {
      const tasks = [...s.life.tasks], old = tasks.find((task) => task.id === id);
      const task: FamilyTask = { ...draft, title: draft.title.trim(), id: old?.id ?? crypto.randomUUID(), groupId: group.id, completions: old?.completions ?? {} };
      if (old) tasks[tasks.indexOf(old)] = task; else tasks.push(task);
      return { ...s, life: { ...s.life, tasks } };
    });
    clear(); toast(t("Family task saved locally.", "Oilaviy vazifa mahalliy saqlandi.")); back();
  };
  return <form className="life-screen" onSubmit={(e) => { e.preventDefault(); save(); }}>
    <PreviewLabel />
    <LifeIntro title={existing ? t("A little change of plan.", "Rejada kichik o‘zgarish.") : t("One less thing to remember.", "Esda tutish uchun yana bir ish kam.")}
      text={group.name} />
    <label className="field">{t("Task name", "Vazifa nomi")}<input required maxLength={160} value={draft.title} placeholder={t("Plan a picnic together", "Birga sayr rejalash")} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="field">{t("Notes", "Izohlar")}<textarea rows={3} maxLength={800} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
    <label className="field">{t("Assigned to", "Kimga berilgan")}<select aria-label={t("Assigned to", "Kimga berilgan")} value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}><option value="">{t("Anyone in the family", "Oiladagi ixtiyoriy a’zo")}</option>{group.members.map((m) => <option key={m.id} value={m.id}>{m.id === "self" ? t("You", "Siz") : m.name}</option>)}</select></label>
    <div className="life-two-fields"><label className="field">{t("Date", "Sana")}<input type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label><label className="field">{t("Time · optional", "Vaqt · ixtiyoriy")}<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label></div>
    <SectionTitle title={t("Repeat on these days", "Shu kunlarda takrorlash")} />
    <div className="life-weekdays">{[t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat"), t("Sun")].map((label, i) => {
      const n = (i + 1) % 7, checked = draft.weekdays.includes(n);
      return <button type="button" key={n} aria-pressed={checked} aria-label={t("Repeat {0}", "{1} kuni takrorlash", [label, ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"][i]])} onClick={() => setDraft({ ...draft, weekdays: checked ? draft.weekdays.filter((d) => d !== n) : [...draft.weekdays, n] })}>{t(label, ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"][i])}</button>;
    })}</div>
    <p className="fine-print">{draft.weekdays.length ? t("Each day has its own completion. Earlier records stay saved when you edit the plan.", "Har bir kun alohida belgilanadi. Reja o‘zgarsa ham oldingi qaydlar saqlanadi.") : t("No days selected: this is a one-time task.", "Kun tanlanmagan: bu bir martalik vazifa.")}</p>
    <Button type="submit" className="wide" disabled={!draft.title.trim() || !draft.date}>{t("Save family task", "Oilaviy vazifani saqlash")}</Button>
  </form>;
}

export function FamilyTaskDetail(props:{id:string;groupId?:string;date?:string}){return useApp().workspace?<ServerTaskDetail {...props}/>:<LocalFamilyTaskDetail {...props}/>;}
function LocalFamilyTaskDetail({ id, date: requested }: { id: string; date?: string }) {
  const t = useText();
  const { state, setState, dispatch, open, back, toast } = useApp();
  const task = state.life.tasks.find((task) => task.id === id), date = requested ?? today(state);
  if (!task || !availableGroups(state).some((g) => g.id === task.groupId)) return <GroupMissing />;
  const group = state.life.groups.find((g) => g.id === task.groupId)!;
  const done = task.completions[date];
  const pinned = (state.dailyPriorities[today(state)] ?? []).some((p) => p.kind === "task" && p.taskId === id && p.date === date);
  const canPin = date === today(state) && taskOccurs(task, date);
  return <div className="life-screen">
    <PreviewLabel />
    <LifeIntro title={task.title} text={group.name} />
    {task.notes && <p className="task-detail-notes">{task.notes}</p>}
    <dl className="life-facts"><div><dt>{t("Assigned to", "Kimga berilgan")}</dt><dd>{task.assignee === "self" ? t("You", "Siz") : group.members.find((m) => m.id === task.assignee)?.name ?? t("Anyone", "Ixtiyoriy a’zo")}</dd></div><div><dt>{t("When", "Qachon")}</dt><dd>{t.date(date)}{task.time && ` · ${task.time}`}</dd></div><div><dt>{t("Repeats", "Takrorlanadi")}</dt><dd>{task.weekdays.length ? t("{0} days a week", "{0} kun haftasiga", [task.weekdays.length]) : t("Once", "Bir marta")}</dd></div></dl>
    {done && <p className="life-success"><Check size={18} />{t("Completed by you", "Siz bajardingiz")} · {date}</p>}
    <Button className="wide" disabled={!taskOccurs(task, date)} variant={done ? "secondary" : "primary"} onClick={() => setState((s) => completeTask(s, id, date, !done))}>{done ? t("Undo completion", "Bajarilganini bekor qilish") : t("Mark as done", "Bajarildi deb belgilash")}</Button>
    <Button variant="secondary" className="wide" disabled={!canPin} onClick={() => {
      if (pinned) { dispatch({ kind: "priority.pin", date: today(state), priority: { kind: "task", taskId: id, date }, selected: false }); return; }
      const current = state.dailyPriorities[today(state)] ?? [];
      if (current.length >= 3) { toast(t("Choose which priority to replace.", "Qaysi ustuvor ishni almashtirishni tanlang.")); open({ type: "priorities", date: today(state) }); return; }
      dispatch({ kind: "priority.pin", date: today(state), priority: { kind: "task", taskId: id, date }, selected: true });
    }}>{pinned ? t("Remove from my priorities", "Ustuvor ishlarimdan olib tashlash") : t("Add to my three priorities", "Uchta ustuvor ishimga qo‘shish")}</Button>
    <Button variant="ghost" className="wide" onClick={() => open({ type: "taskEdit", id })}><Pencil size={17} />{t("Edit task", "Vazifani tahrirlash")}</Button>
    <GroupRow icon={<ClipboardList size={20} />} title={t("Family shared lists", "Oilaning umumiy ro‘yxatlari")} detail={group.name} onClick={() => open({ type: "group", id: group.id, section: "lists" })} />
    <button className="text-button danger-text" onClick={() => { setState((s) => ({ ...s, life: { ...s.life, tasks: s.life.tasks.map((x) => x.id === id ? { ...x, archived: !x.archived } : x) } })); toast(t("Task archived. Completion history is kept.", "Vazifa arxivlandi. Bajarilish tarixi saqlanadi.")); back(); }}>{task.archived ? t("Restore task", "Vazifani tiklash") : t("Archive task", "Vazifani arxivlash")}</button>
    <PrivacyNote>{t("A shared task is its own action. It doesn’t award habit XP.", "Umumiy vazifa alohida ish. U odat XP’sini bermaydi.")}</PrivacyNote>
  </div>;
}

export function ListCreate(props:{groupId:string}){return useApp().workspace?<ServerListCreate {...props}/>:<LocalListCreate {...props}/>;}
function LocalListCreate({ groupId }: { groupId: string }) {
  const t = useText();
  const { state, setState, back, open } = useApp();
  const [draft, setDraft, clear] = useLifeDraft(`new-list:${groupId}`, () => ({ name: "" }));
  if (!availableGroups(state).some((g) => g.id === groupId)) return <GroupMissing />;
  return <form className="life-screen" onSubmit={(e) => {
    e.preventDefault(); if (!draft.name.trim()) return; const id = crypto.randomUUID();
    setState((s) => ({ ...s, life: { ...s.life, lists: [...s.life.lists, { id, groupId, name: draft.name.trim(), items: [] }] } }));
    clear(); back(); open({ type: "sharedList", id });
  }}><PreviewLabel /><LifeIntro title={t("Put it on the list.", "Ro‘yxatga yozib qo‘ying.")} text={t("A few things everyone can help with.", "Hamma yordam bera oladigan kichik ishlar.")} />
    <label className="field">{t("List name", "Ro‘yxat nomi")}<input required value={draft.name} maxLength={80} placeholder={t("For the weekend", "Dam olish kunlari uchun")} onChange={(e) => setDraft({ name: e.target.value })} /></label>
    <Button type="submit" className="wide" disabled={!draft.name.trim()}>{t("Create list", "Ro‘yxat yaratish")}</Button>
  </form>;
}
export function SharedListDetail(props:{id:string;groupId?:string}){return useApp().workspace?<ServerListDetail {...props}/>:<LocalSharedListDetail {...props}/>;}
function LocalSharedListDetail({ id }: { id: string }) {
  const t = useText();
  const { state, setState, back } = useApp();
  const list = state.life.lists.find((list) => list.id === id);
  const [draft, setDraft, clear] = useLifeDraft(`list-item:${id}`, () => ({ id: "", text: "", quantity: "" }));
  const [renaming, setRenaming] = useState(false);
  const [name, setName, clearName] = useLifeDraft(`list-name:${id}`, () => list?.name ?? "");
  if (!list || !availableGroups(state).some((g) => g.id === list.groupId)) return <GroupMissing />;
  const modify = (fn: (copy: SharedList) => void) => setState((s) => { const life = structuredClone(s.life), copy = life.lists.find((l) => l.id === id); if (copy) fn(copy); return { ...s, life }; });
  const add = () => {
    if (!draft.text.trim()) return;
    modify((l) => { const old = l.items.find((i) => i.id === draft.id); if (old) { old.text = draft.text.trim(); old.quantity = draft.quantity.trim(); } else l.items.push({ id: crypto.randomUUID(), text: draft.text.trim(), quantity: draft.quantity.trim(), checked: false }); });
    setDraft({ id: "", text: "", quantity: "" });
  };
  const row = (item: typeof list.items[number]) => {
    const index = list.items.findIndex((i) => i.id === item.id);
    return <div className={`shopping-item ${item.checked ? "checked" : ""}`} key={item.id}>
      <button className={`task-check ${item.checked ? "checked" : ""}`} role="checkbox" aria-checked={item.checked} aria-label={`${t("Check", "Belgilash")} ${item.text}`} disabled={list.archived} onClick={() => modify((l) => { const row = l.items.find((i) => i.id === item.id)!; row.checked = !row.checked; })}>{item.checked ? <Check size={18} /> : <span />}</button>
      <span><strong>{item.text}</strong>{item.quantity && <small>{item.quantity}</small>}</span>
      <button className="icon-button" disabled={list.archived} aria-label={`${t("Edit", "Tahrirlash")} ${item.text}`} onClick={() => setDraft({ id: item.id, text: item.text, quantity: item.quantity })}><Pencil size={16} /></button>
      <details className="item-menu"><summary aria-label={`${item.text} ${t("more actions", "amallar")}`}><Settings2 size={16} /></summary><div>
        <button aria-label={t("Move {0} up", "{0} bandini yuqoriga ko‘chirish", [item.text])} disabled={index === 0 || list.archived} onClick={() => modify((l) => { [l.items[index - 1], l.items[index]] = [l.items[index], l.items[index - 1]]; })}><ArrowUp size={15} />{t("Up", "Yuqoriga")}</button>
        <button aria-label={t("Move {0} down", "{0} bandini pastga ko‘chirish", [item.text])} disabled={index === list.items.length - 1 || list.archived} onClick={() => modify((l) => { [l.items[index + 1], l.items[index]] = [l.items[index], l.items[index + 1]]; })}><ArrowDown size={15} />{t("Down", "Pastga")}</button>
        <button disabled={list.archived} onClick={() => modify((l) => { l.items = l.items.filter((i) => i.id !== item.id); })}><Trash2 size={15} />{t("Remove", "O‘chirish")}</button>
      </div></details>
    </div>;
  };
  return <div className="life-screen">
    <PreviewLabel>{t("Shared list preview · changes stay here", "Umumiy ro‘yxat namunasi · o‘zgarishlar shu yerda")}</PreviewLabel>
    <div className="group-page-heading"><div><h1>{list.name}</h1><p>{list.items.filter((i) => i.checked).length}/{list.items.length} {t("checked", "belgilangan")}</p></div><button className="icon-button" aria-label={t("Rename list", "Ro‘yxat nomini o‘zgartirish")} onClick={() => setRenaming(!renaming)}><Pencil size={19} /></button></div>
    {renaming && <form className="list-rename" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { modify((l) => { l.name = name.trim(); }); clearName(); setRenaming(false); } }}><label className="field">{t("List name", "Ro‘yxat nomi")}<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label><Button variant="secondary" type="submit">{t("Save name", "Nomni saqlash")}</Button></form>}
    {!list.archived && <form className="list-add-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <label className="field">{draft.id ? t("Edit item", "Bandni tahrirlash") : t("Add an item", "Band qo‘shish")}<input maxLength={160} required value={draft.text} placeholder={t("What do we need?", "Nima kerak?")} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>
      <div className="list-add-bottom"><label className="field">{t("Quantity or note", "Miqdor yoki izoh")}<input maxLength={80} value={draft.quantity} placeholder={t("e.g. 1 kg", "masalan, 1 kg")} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><Button type="submit" disabled={!draft.text.trim()}><Plus size={18} />{draft.id ? t("Save", "Saqlash") : t("Add", "Qo‘shish")}</Button></div>
      {draft.id && <button type="button" className="text-button" onClick={() => { clear(); setDraft({ id: "", text: "", quantity: "" }); }}>{t("Cancel edit", "Tahrirni bekor qilish")}</button>}
    </form>}
    <div className="shopping-list">{list.items.filter((i) => !i.checked).map(row)}</div>
    {!list.items.length && <div className="people-empty"><ClipboardList size={30} /><p>{t("An empty list, ready for a little everyday life.", "Kundalik ishlar uchun tayyor bo‘sh ro‘yxat.")}</p></div>}
    {list.items.some((i) => i.checked) && <details className="done-group" open><summary>{t("Already got it", "Allaqachon olindi")} · {list.items.filter((i) => i.checked).length}</summary>{list.items.filter((i) => i.checked).map(row)}</details>}
    <button className="text-button" onClick={() => { modify((l) => { l.archived = !l.archived; }); back(); }}>{list.archived ? t("Restore list", "Ro‘yxatni tiklash") : t("Archive list", "Ro‘yxatni arxivlash")}</button>
  </div>;
}

function SharedUpdateCard({ update, group, preview = false }: { update: SquadUpdate; group: LocalGroup; preview?: boolean }) {
  const t = useText();
  const { state, setState, open } = useApp();
  const name = update.memberId === "self" ? state.name : group.members.find((m) => m.id === update.memberId)?.name ?? t("Former member", "Sobiq a’zo");
  return <article className="squad-update">
    <header><Avatar name={name} /><span><strong>{name}</strong><small>{t.week(update.week)} · {t("weekly update", "haftalik yangilik")}</small></span>{update.memberId === "self" && !preview && <button className="icon-button" aria-label={t("Edit my update", "Yangiligimni tahrirlash")} onClick={() => open({ type: "squadCompose", groupId: group.id, date: update.week })}><Pencil size={17} /></button>}</header>
    <div className="shared-summary">{update.habits !== undefined && <span><Sprout size={16} />{t("{0} habit check-ins", "{0} odat qaydlari", [update.habits])}</span>}{update.milestones?.map((m, i) => <span key={i}><CheckCheck size={16} />{m}</span>)}{update.prayers !== undefined && <span><Check size={16} />{t("{0} prayers recorded", "{0} namoz qayd etilgan", [update.prayers])}</span>}</div>
    {update.note && <p>{update.note}</p>}
    {!preview && <footer><button aria-pressed={!!update.reactions.self} onClick={() => setState((s) => ({ ...s, life: { ...s.life, updates: s.life.updates.map((u) => { if (u.id !== update.id) return u; const reactions = { ...u.reactions }; if (reactions.self) delete reactions.self; else reactions.self = "encourage"; return { ...u, reactions }; }) } }))}><Heart size={16} />{t("Cheering you on", "Sizni qo‘llab-quvvatlayman")}{Object.keys(update.reactions).length > 0 && <span>{Object.keys(update.reactions).length}</span>}</button></footer>}
  </article>;
}
function SquadFeed({ group }: { group: LocalGroup }) {
  const t = useText();
  const { state, open } = useApp();
  const current = weekStart(today(state)), [week, setWeek] = useState(current);
  const updates = state.life.updates.filter((u) => u.groupId === group.id && u.week === week);
  return <>
    <div className="shared-week family-date"><button className="icon-button" aria-label={t("Previous squad week", "Oldingi guruh haftasi")} onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={19} /></button><div><strong>{t.week(week)}</strong><span>{t("Monday–Sunday · Asia/Tashkent", "Dushanba–yakshanba · Asia/Tashkent")}</span></div><button className="icon-button" aria-label={t("Next squad week", "Keyingi guruh haftasi")} disabled={week >= current} onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={19} /></button></div>
    <div className="squad-invitation"><Sprout size={23} /><h2>{t("What felt good this week?", "Bu hafta nima yaxshi bo‘ldi?")}</h2><p>{t("A small win. Something you learned. Only what you want to share.", "Kichik yutuq. O‘rgangan narsangiz. Faqat o‘zingiz xohlaganini ulashing.")}</p><Button variant="secondary" onClick={() => open({ type: "squadCompose", groupId: group.id, date: week })}>{updates.some((u) => u.memberId === "self") ? t("Edit my weekly update", "Haftalik yangiligimni tahrirlash") : t("Share my week", "Haftamni ulashish")}<ArrowRight size={17} /></Button></div>
    <PrivacyNote>{t("You choose each update. Your prayer history and private pause are never visible to members.", "Har bir yangilikni o‘zingiz tanlaysiz. Namoz tarixi va shaxsiy tanaffus a’zolarga ko‘rinmaydi.")}</PrivacyNote>
    {updates.map((update) => <SharedUpdateCard key={update.id} update={update} group={group} />)}
    {!updates.length && <p className="section-description">{t("No updates for this week yet. There’s no rush.", "Bu hafta hali yangilik yo‘q. Shoshilmang.")}</p>}
  </>;
}
function LocalSquadCompose({ groupId, week: requested }: { groupId: string; week?: string }) {
  const t = useText();
  const { state, setState, back, toast } = useApp(), week = requested ?? weekStart(today(state));
  const group = availableGroups(state).find((g) => g.id === groupId);
  const existing = state.life.updates.find((u) => u.groupId === groupId && u.memberId === "self" && u.week === week);
  const [draft, setDraft, clear] = useLifeDraft(`squad:${groupId}:${week}`, () => ({ note: existing?.note ?? "", habits: existing?.habits !== undefined, milestones: existing?.milestones !== undefined, prayers: existing?.prayers !== undefined }));
  const [snapshot, setSnapshot] = useState<SquadUpdate | null>(null);
  if (!group) return <GroupMissing />;
  const build = (): SquadUpdate => {
    const result: SquadUpdate = { id: existing?.id ?? crypto.randomUUID(), groupId, memberId: "self", week, note: draft.note.trim(), reactions: existing?.reactions ?? {} };
    if (draft.habits) result.habits = weeklyHabits(state, week).checked;
    if (draft.milestones) result.milestones = weekGoalMovement(state, week).flatMap(({ goal }) => goal.milestones.filter((m) => m.completedOn && m.completedOn >= week && m.completedOn <= addDays(week, 6) && m.completedOn <= today(state)).map((m) => m.title));
    if (draft.prayers) { const p = weeklyPrayers(state, week); result.prayers = p.on_time + p.later; }
    return result;
  };
  const hasContent = !!draft.note.trim() || draft.habits || draft.milestones || draft.prayers;
  return <div className="life-screen">
    <PreviewLabel>{t("Sharing preview · no real messages are sent", "Ulashish namunasi · haqiqiy xabar yuborilmaydi")}</PreviewLabel>
    <LifeIntro title={snapshot ? t("This is all they’d see.", "Ular faqat shuni ko‘radi.") : t("Your week, in your words.", "Haftangizni o‘z so‘zlaringiz bilan.")}
      text={`${group.name} · ${t.week(week)}`} />
    {snapshot ? <>
      <SharedUpdateCard update={snapshot} group={group} preview />
      <PrivacyNote>{t("This snapshot contains only the information shown above. It won’t update automatically.", "Bu nusxa faqat yuqorida ko‘rsatilgan ma’lumotni o‘z ichiga oladi. U avtomatik yangilanmaydi.")}</PrivacyNote>
      <Button className="wide" onClick={() => { setState((s) => ({ ...s, life: { ...s.life, updates: [...s.life.updates.filter((u) => !(u.groupId === groupId && u.memberId === "self" && u.week === week)), snapshot] } })); clear(); toast(t("Update published to the local demo.", "Yangilik mahalliy namunada e’lon qilindi.")); back(); }}><Share2 size={17} />{t("Publish to demo squad", "Namunaviy guruhga e’lon qilish")}</Button>
      <Button variant="ghost" className="wide" onClick={() => setSnapshot(null)}>{t("Back to editing", "Tahrirlashga qaytish")}</Button>
    </> : <>
      <label className="field">{t("A little reflection", "Kichik mulohaza")}<textarea rows={5} maxLength={600} value={draft.note} placeholder={t("One small thing that helped me this week…", "Bu hafta menga yordam bergan kichik narsa…")} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
      <SectionTitle title={t("Choose what to include", "Nimani ulashishni tanlang")} />
      <div className="group"><GroupRow icon={<Sprout size={19} />} title={t("Habit check-in count", "Odat qaydlari soni")} detail={t("One total, without habit names", "Odat nomlarisiz umumiy son")} end={<Toggle label={t("Include habit count", "Odat qaydlari sonini qo‘shish")} checked={draft.habits} onChange={() => setDraft({ ...draft, habits: !draft.habits })} />} />
        <GroupRow icon={<CheckCheck size={19} />} title={t("Completed milestones", "Bajarilgan bosqichlar")} detail={t("Titles of this week’s milestones", "Bu haftada bajarilgan bosqichlar nomi")} end={<Toggle label={t("Include milestones", "Bajarilgan bosqichlarni qo‘shish")} checked={draft.milestones} onChange={() => setDraft({ ...draft, milestones: !draft.milestones })} />} />
        <GroupRow icon={<LockKeyhole size={19} />} title={t("Prayer total · optional", "Namozlar soni · ixtiyoriy")} detail={t("A total only. No dates or missed records.", "Faqat umumiy son. Sana va qoldirilgan qaydlar yo‘q.")} end={<Toggle label={t("Include prayer total", "Namozlar sonini qo‘shish")} checked={draft.prayers} onChange={() => setDraft({ ...draft, prayers: !draft.prayers })} />} /></div>
      <Button className="wide" disabled={!hasContent} onClick={() => setSnapshot(build())}>{t("Preview my update", "Yangiligimni ko‘rish")}<ArrowRight size={18} /></Button>
      {existing && <button className="text-button danger-text" onClick={() => { setState((s) => ({ ...s, life: { ...s.life, updates: s.life.updates.filter((u) => u.id !== existing.id) } })); clear(); toast(t("Your update was withdrawn.", "Yangiligingiz olib tashlandi.")); back(); }}>{t("Withdraw my update", "Yangiligimni olib tashlash")}</button>}
    </>}
  </div>;
}

function LocalGroupSettings({ id }: { id: string }) {
  const t = useText();
  const { state, setState, back, open, toast } = useApp();
  const group = availableGroups(state).find((g) => g.id === id), [confirm, setConfirm] = useState<"leave" | "archive" | null>(null);
  if (!group) return <GroupMissing />;
  const owner = group.members.find((m) => m.id === "self")?.role === "owner";
  const change = (fn: (g: LocalGroup) => void) => setState((s) => { const life = structuredClone(s.life), g = life.groups.find((g) => g.id === id); if (g) fn(g); return { ...s, life }; });
  return <div className="life-screen">
    <PreviewLabel />
    <LifeIntro title={t("A space that feels right.", "Sizga mos joy.")} text={group.name} />
    <label className="field">{t("Group name", "Guruh nomi")}<input aria-label={t("Group name", "Guruh nomi")} value={group.name} maxLength={80} disabled={!owner} onChange={(e) => change((g) => { g.name = e.target.value; })} onBlur={() => { if (!group.name.trim()) change((g) => { g.name = t("Our group", "Bizning guruh"); }); }} /></label>
    <GroupRow icon={<Bell size={19} />} title={t("Group notifications", "Guruh bildirishnomalari")} detail={t("Preference only · no delivery in prototype", "Faqat sozlama · prototip yubormaydi")} end={<Toggle label={t("Group notifications", "Guruh bildirishnomalari")} checked={!group.muted} onChange={() => change((g) => { g.muted = !g.muted; })} />} />
    <div className="life-two-fields"><label className="field">{t("Quiet hours from", "Sokin vaqt boshlanishi")}<input type="time" value={group.quietStart} onChange={(e) => change((g) => { g.quietStart = e.target.value; })} /></label><label className="field">{t("Until", "Tugashi")}<input type="time" value={group.quietEnd} onChange={(e) => change((g) => { g.quietEnd = e.target.value; })} /></label></div>
    <SectionTitle title={t("Members", "A’zolar")} />
    <div className="member-list">{group.members.map((m) => <div key={m.id}><Avatar name={m.name} /><span><strong>{m.id === "self" ? t("You", "Siz") : m.name}</strong><small>{m.role === "owner" ? t("Owner", "Guruh egasi") : t("Member · fictional", "A’zo · xayoliy")}</small></span>{owner && m.id !== "self" && <button className="icon-button" aria-label={t("Remove {0}", "{0} a’zosini olib tashlash", [m.name])} onClick={() => { change((g) => { g.members = g.members.filter((x) => x.id !== m.id); }); toast(t("Demo member removed.", "Namunaviy a’zo olib tashlandi.")); }}><X size={18} /></button>}</div>)}</div>
    {owner && <Button variant="secondary" className="wide" onClick={() => open({ type: "invite", id })}><UserPlus size={18} />{t("Preview an invitation", "Taklif namunasini ko‘rish")}</Button>}
    {owner && group.members.length > 1 && <label className="field">{t("Transfer ownership", "Egalikni topshirish")}<select aria-label={t("Transfer ownership", "Egalikni topshirish")} value="" onChange={(e) => { if (e.target.value) change((g) => { g.members.forEach((m) => { m.role = m.id === e.target.value ? "owner" : "member"; }); }); }}><option value="">{t("Choose a member", "A’zoni tanlang")}</option>{group.members.filter((m) => m.id !== "self").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
    <PrivacyNote>{t("Even the group owner cannot see your private prayer or habit records.", "Guruh egasi ham shaxsiy namoz va odat qaydlaringizni ko‘ra olmaydi.")}</PrivacyNote>
    {confirm ? <div className="local-confirm"><h2>{confirm === "archive" ? t("Archive this group?", "Bu guruh arxivlansinmi?") : t("Leave this group?", "Guruhni tark etasizmi?")}</h2><p>{confirm === "archive" ? t("Its content stays saved. Restore it from Your people.", "Ma’lumotlar saqlanadi. Yaqinlaringiz bo‘limida tiklashingiz mumkin.") : t("Shared content stays in the demo. Your private progress is unchanged.", "Umumiy ma’lumotlar namunada qoladi. Shaxsiy natijalaringiz o‘zgarmaydi.")}</p><Button variant="danger" onClick={() => { change((g) => { if (confirm === "archive") g.archived = true; else g.left = true; }); back(); }}>{t("Confirm", "Tasdiqlash")}</Button><Button variant="ghost" onClick={() => setConfirm(null)}>{t("Cancel", "Bekor qilish")}</Button></div> :
      <div className="detail-actions">{owner && <button className="text-button danger-text" onClick={() => setConfirm("archive")}>{t("Archive group", "Guruhni arxivlash")}</button>}<button className="text-button danger-text" disabled={owner} onClick={() => setConfirm("leave")}>{t("Leave group", "Guruhni tark etish")}</button>{owner && <p className="fine-print">{t("Transfer ownership before leaving, or archive the group.", "Chiqishdan oldin egalikni topshiring yoki guruhni arxivlang.")}</p>}</div>}
  </div>;
}
function LocalInvitationPreview({ id }: { id: string }) {
  const t = useText();
  const { state, setState } = useApp();
  const group = availableGroups(state).find((g) => g.id === id);
  const [memberName, setMemberName] = useState("Samir");
  if (!group) return <GroupMissing />;
  const owner = group.members.find((m) => m.id === "self")?.role === "owner";
  const change = (fn: (g: LocalGroup) => void) => setState((s) => { const life = structuredClone(s.life), g = life.groups.find((g) => g.id === id); if (g) fn(g); return { ...s, life }; });
  const invitation = [...group.invitations].reverse().find((invite) => !invite.revoked && !invite.accepted && invite.expires >= today(state));
  return <div className="life-screen">
    <PreviewLabel>{t("Invitation simulation · nobody is contacted", "Taklif namunasi · hech kimga yuborilmaydi")}</PreviewLabel>
    <LifeIntro title={t("An invitation, not an obligation.", "Taklif — majburiyat emas.")}
      text={`${t("A private invitation to", "Shaxsiy taklif")}: ${group.name}`} />
    <div className="invite-pass"><UserPlus size={32} /><h2>{group.name}</h2><p>{t("Join for the little things we do together.", "Birgalikdagi kichik ishlar uchun qo‘shiling.")}</p><small>{t("Demo adults only · sharing stays off", "Faqat namunaviy kattalar · ulashish o‘chiq")}</small></div>
    {invitation ? <><div className="invitation-code"><span>{t("Sample invitation code", "Namunaviy taklif kodi")}</span><strong>{invitation.code}</strong><small>{t("Single use · expires", "Bir martalik · amal qilish muddati")} {invitation.expires}</small></div>
      <label className="field">{t("Fictional member name", "Xayoliy a’zo nomi")}<input maxLength={40} value={memberName} onChange={(e) => setMemberName(e.target.value)} /></label>
      <Button className="wide" disabled={!memberName.trim()} onClick={() => change((g) => { const invite = g.invitations.find((i) => i.id === invitation.id); if (!invite || invite.accepted || invite.revoked || invite.expires < today(state)) return; invite.accepted = true; g.members.push({ id: crypto.randomUUID(), name: memberName.trim(), role: "member" }); })}>{t("Simulate invitation accepted", "Taklif qabul qilinishini sinash")}</Button>
      {owner && <button className="text-button danger-text" onClick={() => change((g) => { g.invitations.find((i) => i.id === invitation.id)!.revoked = true; })}>{t("Revoke invitation", "Taklifni bekor qilish")}</button>}
    </> : <><p className="section-description">{group.invitations.some((i) => i.accepted) ? t("Demo invitation accepted. The fictional member is now in the group.", "Namunaviy taklif qabul qilindi. Xayoliy a’zo guruhga qo‘shildi.") : t("A real invitation would expire after seven days and work once.", "Haqiqiy taklif yetti kun amal qiladi va bir marta ishlatiladi.")}</p><Button className="wide" disabled={!owner} onClick={() => change((g) => { const token = crypto.randomUUID(); g.invitations.push({ id: token, code: `RISE-DEMO-${token.slice(0, 6).toUpperCase()}`, expires: addDays(today(state), 7) }); })}>{t("Create sample invitation", "Namunaviy taklif yaratish")}</Button></>}
    <PrivacyNote>{t("This code has no external destination. It only demonstrates joining this local group.", "Bu kod tashqi manzilga ega emas. U faqat mahalliy guruhga qo‘shilishni ko‘rsatadi.")}</PrivacyNote>
  </div>;
}
