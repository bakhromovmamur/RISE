import {Check,ChevronRight,Home,LockKeyhole} from 'lucide-react';
import {useApp} from '../context';
import {useText} from '../LifeUI';
import {availableGroups,availableTasks,completeTask,type FamilyTask} from '../lifeModel';
import {today} from '../model';
import {ServerFamilyToday} from './SharedToday';

export function TaskRow({ task, date, priority = false }: { task: FamilyTask; date: string; priority?: boolean }) {
  const t = useText();
  const { state, setState, open } = useApp();
  const done = task.completions[date], group = state.life.groups.find((g) => g.id === task.groupId);
  const member = group?.members.find((m) => m.id === task.assignee);
  const unavailable = !group || group.archived || group.left || task.archived;
  if (unavailable) return <article className="family-task"><LockKeyhole size={19} /><div className="task-copy"><strong>{t("Family task unavailable", "Oilaviy vazifa mavjud emas")}</strong><small>{t("Edit your priorities to choose another action.", "Boshqa ishni tanlash uchun muhim ishlaringizni tahrirlang.")}</small></div></article>;
  return <article className={`family-task ${priority ? "priority-task" : ""} ${done ? "completed" : ""}`}>
    <button className={`task-check ${done ? "checked" : ""}`} role="checkbox" aria-checked={!!done} aria-label={`${t("Complete", "Bajarish")} ${task.title}`} disabled={unavailable} onClick={() => setState((s) => completeTask(s, task.id, date, !done))}>{done ? <Check size={19} /> : <span />}</button>
    <button className="task-copy" onClick={() => open({ type: "task", id: task.id, date })}><strong>{task.title}</strong><small>{task.assignee === "self" ? t("You", "Siz") : member?.name ?? t("Anyone", "Ixtiyoriy a’zo")}{task.time ? ` · ${task.time}` : ""}{done ? ` · ${t("Done", "Bajarildi")}` : ""}</small>{priority && <small className="task-family-label"><Home size={12} />{group?.name ?? t("Family task", "Oilaviy vazifa")}</small>}</button>
    <ChevronRight size={16} className="muted" />
  </article>;
}
export function FamilyToday(){return useApp().workspace?<ServerFamilyToday/>:<LocalFamilyToday/>;}
function LocalFamilyToday() {
  const t = useText();
  const { state, open } = useApp(), date = today(state);
  const pinned = new Set((state.dailyPriorities[date] ?? []).filter((p) => p.kind === "task").map((p) => p.taskId));
  const tasks = availableTasks(state, date).filter((task) => (task.assignee === "self" || !task.assignee) && !pinned.has(task.id));
  if (!availableGroups(state).some((g) => g.kind === "family")) return null;
  const pending = tasks.filter((task) => !task.completions[date]), done = tasks.filter((task) => task.completions[date]);
  return <details className="today-disclosure family-today">
    <summary><Home size={20} /><span><strong>{t("Family", "Oila")}</strong><small>{pending.length ? t("{0} to do together", "{0} birgalikda bajariladigan ish", [pending.length]) : t("A little breathing room", "Biroz erkin vaqt")}</small></span><ChevronRight size={18} /></summary>
    <div className="disclosure-content">
    {pending.map((task) => <TaskRow key={task.id} task={task} date={date} />)}
    {!pending.length && <p className="fine-print">{t("Nothing else assigned to you today.", "Bugun sizga boshqa vazifa berilmagan.")}</p>}
    {!!done.length && <details className="done-group"><summary>{t("Done together", "Birga bajarildi")} · {done.length}</summary>{done.map((task) => <TaskRow key={task.id} task={task} date={date} />)}</details>}
    <button className="text-button" onClick={() => open({ type: "groups" })}>{t("Tasks & shared lists", "Vazifalar va umumiy ro‘yxatlar")}<ChevronRight size={15} /></button>
    </div>
  </details>;
}
