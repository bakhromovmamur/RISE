import { exact } from "./personalCommands";
import { uuid } from "./accountCommands";
import * as v from "../data/validation";

export interface DeletionStatus { accountId:string; requestId:string; requestedAt:string; purgeBy:string; purgedAt:string|null }
export function parseDeletionStatus(value:unknown):DeletionStatus {
  const row=v.object(value,"deletion");
  exact({accountId:v.string(36),requestId:v.string(36),requestedAt:v.instant,purgeBy:v.instant,purgedAt:v.nullable(v.instant)})(row,"deletion");
  if(!uuid(row.accountId)||!uuid(row.requestId)||Date.parse(String(row.purgeBy))<Date.parse(String(row.requestedAt)))throw new v.StoredDataError("deletion");
  return {accountId:row.accountId,requestId:row.requestId,requestedAt:String(row.requestedAt),purgeBy:String(row.purgeBy),purgedAt:row.purgedAt===null?null:String(row.purgedAt)};
}
