import { exact } from "./personalCommands";
import { uuid } from "./accountCommands";
import * as v from "../data/validation";
export interface DeletionLedger { format:"rise.deletion-ledger";version:1;environment:"local"|"test";installationId:string;entries:{id:string;deletedAt:string}[] }
export function parseDeletionLedger(raw:string,environment:"local"|"test",installationId:string):DeletionLedger{
  if(new TextEncoder().encode(raw).length>1024*1024)throw new v.StoredDataError("ledger size");
  const row=v.object(v.parseJson(raw),"ledger");
  exact({format:v.oneOf("rise.deletion-ledger"),version:v.oneOf(1),environment:v.oneOf(environment),installationId:v.oneOf(installationId),entries:v.array(exact({id:v.string(36),deletedAt:v.instant}),10000)})(row,"ledger");
  const entries=row.entries as DeletionLedger["entries"];
  if(new Set(entries.map(r=>r.id)).size!==entries.length||entries.some(r=>!uuid(r.id)||Date.parse(r.deletedAt)>Date.now()+300000))throw new v.StoredDataError("ledger entries");
  return {format:"rise.deletion-ledger",version:1,environment,installationId,entries};
}
