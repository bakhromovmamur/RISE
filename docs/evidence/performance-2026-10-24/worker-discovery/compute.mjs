import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export async function load(root) {
  const require=createRequire(`${root}/package.json`),{register}=await import(pathToFileURL(require.resolve('tsx/esm/api')));
  register();
  const [{hydrate,project},{validateState},{applyDomainCommand},{xpTotal}]=await Promise.all([
    import(pathToFileURL(`${root}/src/contracts/personalRecords.ts`)),import(pathToFileURL(`${root}/src/data/storedState.ts`)),
    import(pathToFileURL(`${root}/src/domain/commands.ts`)),import(pathToFileURL(`${root}/src/model.ts`))]);
  return function compute(records,context) {
    const state=hydrate(records),next=applyDomainCommand(state,{kind:'habit.check',habitId:state.habits[0].id,date:context.date,check:'full'},context);
    validateState(next);
    return {records:project(next,String(records.profiles[0].started_on)),xp:xpTotal(next)};
  };
}
