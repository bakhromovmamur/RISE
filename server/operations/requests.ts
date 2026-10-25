export type RequestArea = 'health'|'auth'|'sync'|'personal'|'groups'|'push'|'lifecycle'|'static'|'other';
export function requestArea(route: string | undefined): RequestArea {
  if(route?.startsWith('/api/v1/health/'))return 'health';
  if(route?.startsWith('/api/v1/auth/')||route==='/api/v1/logout')return 'auth';
  if(route?.startsWith('/api/v1/sync/'))return 'sync';
  if(route?.startsWith('/api/v1/personal'))return 'personal';
  if(route?.startsWith('/api/v1/groups')||route?.startsWith('/api/v1/squads'))return 'groups';
  if(route?.startsWith('/api/v1/push'))return 'push';
  if(route?.startsWith('/api/v1/account/'))return 'lifecycle';
  return route==='/*'?'static':'other';
}
export interface RequestDiagnostic {
  event:'request'; requestId:string; area:RequestArea; status:number; durationMs:number;
  release:string; webRelease:string; at:string;
}
export interface RequestSummary {
  sampledAt:string; release:string; webRelease:string; windowSeconds:300;
  requests:number; serverErrors:number; syncFailures:number; syncConflicts:number; rateLimited:number; slowRequests:number;
}
/** Five-minute counts, bounded to six minute buckets. No actors, URLs or request bodies. */
export class RequestMetrics {
  private buckets=new Map<number,Omit<RequestSummary,'sampledAt'|'release'|'webRelease'|'windowSeconds'>>();
  constructor(private release:string,private webRelease:string){}
  record(entry:RequestDiagnostic,now=Date.now()) {
    this.prune(now);
    const minute=Math.floor(now/60000),bucket=this.buckets.get(minute)??{requests:0,serverErrors:0,syncFailures:0,syncConflicts:0,rateLimited:0,slowRequests:0};
    if(entry.area==='health')return;
    bucket.requests++;bucket.serverErrors+=Number(entry.status>=500);
    bucket.syncFailures+=Number(entry.area==='sync'&&entry.status>=500);
    bucket.syncConflicts+=Number(entry.area==='sync'&&entry.status===409);
    bucket.rateLimited+=Number(entry.area==='auth'&&entry.status===429);bucket.slowRequests+=Number(entry.durationMs>=2000);
    this.buckets.set(minute,bucket);
  }
  private prune(now:number){for(const minute of this.buckets.keys())if(minute<=Math.floor(now/60000)-5||minute>Math.floor(now/60000))this.buckets.delete(minute);}
  snapshot(now=Date.now()):RequestSummary {
    this.prune(now);
    const result:RequestSummary={sampledAt:new Date(now).toISOString(),release:this.release,webRelease:this.webRelease,windowSeconds:300,requests:0,serverErrors:0,syncFailures:0,syncConflicts:0,rateLimited:0,slowRequests:0};
    for(const bucket of this.buckets.values())for(const key of ['requests','serverErrors','syncFailures','syncConflicts','rateLimited','slowRequests'] as const)result[key]+=bucket[key];
    return result;
  }
}

declare module 'fastify' {interface FastifyInstance {operationsSnapshot:()=>RequestSummary}}
