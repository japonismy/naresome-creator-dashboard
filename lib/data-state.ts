import type {Video} from './dashboard-schema';
type Group=Video['engaged'];
type MetricVideo=Pick<Video,'publishedAt'|'engaged'|'average'|'engagedViews'|'averageViewDuration'|'averageViewPercentage'>;

export function metricLabel(status:Group['status']){
  if(status==='error')return '取得失敗';
  if(status==='forbidden'||status==='disabled')return '取得不可';
  if(status==='stale')return '再取得待ち';
  return '集計待ち';
}
export function metricPeriod(group:Group){return group.availableThrough?group.availableThrough.slice(5).replace('-','/')+'まで':'';}
export function normalizeAnalytics<T extends MetricVideo>(video:T):T{
  if(!video.publishedAt)return video;
  const published=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Los_Angeles'}).format(new Date(video.publishedAt));
  const ev=!!video.engaged.availableThrough&&video.engaged.availableThrough<published;
  const average=!!video.average.availableThrough&&video.average.availableThrough<published;
  const gated=(g:Group):Group=>({...g,status:['stale','error','forbidden'].includes(g.status)?g.status:'pending'});
  return {...video,...(ev?{engaged:gated(video.engaged),engagedViews:null}:{}),...(average?{average:gated(video.average),averageViewDuration:null,averageViewPercentage:null}:{})};
}
export function emptyComments(status:Group['status'],query:string){
  if(status==='error')return 'コメントを取得できませんでした。次回更新で再取得します。';
  if(status==='forbidden')return 'コメントを取得できません。取得権限をご確認ください。';
  if(status==='disabled')return 'コメントは無効です。';
  if(status==='stale')return 'コメントの再取得待ちです。';
  if(status!=='ok')return 'コメントの取得待ちです。';
  if(query)return '一致するコメントはありません。';
  return 'コメントはまだありません。';
}
export function refreshLate(generatedAt:string,now=Date.now()){
  // Allow an hour for each 02:10/14:10 JST refresh to finish and publish.
  const local=new Date(now+9*3600000),day=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
  const schedules=[day-86400000+14*3600000,day+2*3600000,day+14*3600000].map(n=>n+10*60000-9*3600000).filter(n=>n+3600000<=now);
  return schedules.length>0&&Date.parse(generatedAt)<Math.max(...schedules);
}
