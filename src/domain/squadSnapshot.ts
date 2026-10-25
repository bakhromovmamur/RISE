import type {State} from '../model';
import {addDays,localDate} from './calendar';
import {weeklyHabits,weekGoalMovement} from '../developmentModel';
import {prayerMoment,weeklyPrayers} from '../prayerModel';
import {parseSquadSnapshot,type SquadSnapshot,type SquadPreviewRequest} from '../contracts/squads';

/** The caller supplies committed owner data and the database clock. Reuse the
 * same dated totals as Progress; do not persist this clock-bound view. */
export function buildSquadSnapshot(state:State,input:Pick<SquadPreviewRequest,'week'|'note'|'choices'>,now:number):SquadSnapshot {
 const date=localDate(state.timezone,new Date(now)),view:State={...state,mode:'demo',demoDate:date};
 const result:SquadSnapshot={week:input.week,note:input.note.trim()};
 if(input.choices.habits)result.habits=weeklyHabits(view,input.week).checked;
 if(input.choices.milestones)result.milestones=weekGoalMovement(view,input.week).flatMap(({goal})=>goal.milestones.filter(m=>m.completedOn&&m.completedOn>=input.week&&m.completedOn<=addDays(input.week,6)&&m.completedOn<=date).map(m=>m.title));
 if(input.choices.prayers){const counts=weeklyPrayers(state,input.week,prayerMoment({...state,mode:'fresh'},new Date(now)));result.prayers=counts.on_time+counts.later;}
 return parseSquadSnapshot(result);
}
