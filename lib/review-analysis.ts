import type {Video,CatalogVideo} from './dashboard-schema';

export type Period='days7'|'days28'|'lifetime';
export const PERIOD_LABELS:Record<Period,string>={days7:'公開日から7日',days28:'公開日から28日',lifetime:'累計'};
type ReviewVideo=Video|CatalogVideo;
export function metricsFor(video:ReviewVideo,period:Period){return video.reviewMetrics?.[period]??null;}
export function engagedRatio(video:ReviewVideo,period:Period){
  const m=metricsFor(video,period);
  // Older cumulative views span the August 24 definition change. Do not score them.
  if(!m||m.status!=='ok'||!m.complete||!m.views||m.engagedViews==null||m.engagedViews>m.views||!video.publishedAt||video.publishedAt<'2026-08-24T07:00:00Z')return null;
  return m.engagedViews/m.views*100;
}
export function likeRate(video:ReviewVideo,period:Period){const m=metricsFor(video,period);return m?.status==='ok'&&m.complete&&m.engagedViews&&m.likes!=null?m.likes/m.engagedViews*1000:null;}
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length?a.length%2?a[i]:(a[i-1]+a[i])/2:0;};
export type Moment={index:number;start:number;end:number;before:number;after:number;drop:number};
export function frontDrop(points:Video['retention']['points'],duration:number,limit=duration*.5):Moment|null{
  // Include the opening. No assumed 100% starting point is added.
  const candidates=points.slice(1).map((p,j)=>({index:j+1,start:j?points[j-1].ratio*duration:0,end:p.ratio*duration,before:points[j].value,after:p.value,drop:(points[j].value-p.value)*100})).filter(p=>p.end<=limit&&p.drop>.1);
  return candidates.sort((a,b)=>b.drop-a.drop)[0]??null;
}
export function openingTrend(video:Video){
  const points=video.retention.points;
  const empty={text:'傾向を読むための測定区間が足りません。',early:null as null|{start:number;end:number;fall:number;count:number},later:null as null|{start:number;end:number;fall:number;count:number}};
  if(video.retention.status!=='ok'||points.length!==100)return {...empty,text:'取得済みの曲線を参考に、冒頭から確認してください。'};
  if((video.engagedViews??0)<100)return {...empty,text:'視聴データが少ないため、傾向はまだ表示しません。'};
  const fit=(begin:number,end:number)=>{
    const samples=points.map((p,i)=>({start:i?points[i-1].ratio*video.durationSeconds:0,end:p.ratio*video.durationSeconds,value:p.value})).filter(p=>p.start>=begin-.0001&&p.end<=end+.0001);
    if(samples.length<3)return null;
    const xs=samples.map(p=>(p.start+p.end)/120),ys=samples.map(p=>p.value*100),mx=xs.reduce((s,x)=>s+x,0)/xs.length,my=ys.reduce((s,y)=>s+y,0)/ys.length;
    const den=xs.reduce((s,x)=>s+(x-mx)**2,0);if(!den)return null;
    const fall=-xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/den;
    return {start:samples[0].start,end:samples.at(-1)!.end,fall,count:samples.length};
  };
  const early=fit(0,120),later=fit(120,Math.min(300,video.durationSeconds*.5));
  if(!early||!later)return {...empty,early,later};
  // Observational labels, not quality/causal judgments. Compare this video's two
  // fitted rates (percentage points/minute); cutoffs are documented display rules.
  let text='冒頭後も、下がり方はおおむね同程度です。';
  if(early.fall<=.1)text=later.fall>.1?'冒頭より、その後の下がり方が大きくなっています。':'この範囲は、おおむね横ばい〜上向きです。';
  else if(later.fall<=.1)text='冒頭後は、横ばい〜上向きに変わっています。';
  else if(later.fall<early.fall*.5)text='冒頭に比べ、その後の下がり方は緩やかです。';
  else if(later.fall>early.fall*1.5)text='冒頭より、その後の下がり方が大きくなっています。';
  return {text,early,later};
}

export function prioritizedMoments(video:Video){
  if(video.retention.status!=='ok'||(video.engagedViews??0)<100)return {opening:[],front:[],rear:[]};
  const front=frontDrop(video.retention.points,video.durationSeconds);
  const peaks=localPeaks(video.retention.points,video.durationSeconds,.05,.5);
  const rearPeaks=localPeaks(video.retention.points,video.durationSeconds,.5,.9);
  const normalChanges=video.retention.points.slice(1).map((p,i)=>Math.abs(p.value-video.retention.points[i].value)*100),baseline=median(normalChanges),mad=median(normalChanges.map(v=>Math.abs(v-baseline)));
  const required=Math.max((front?.drop??0)*.25,baseline+6*mad,.1);
  const rear=[...localMoments(video.retention.points,video.durationSeconds,.5,.9).map(m=>({...m,kind:'dip' as const})),...rearPeaks.map(m=>({...m,kind:'peak' as const}))].filter(m=>{
    if(m.start<video.durationSeconds*.5)return false;
    const local=video.retention.points.map((p,i)=>({time:p.ratio*video.durationSeconds,change:i?Math.abs(p.value-video.retention.points[i-1].value)*100:0})).filter(p=>p.time>=m.start&&p.time<=m.end);
    return local.some(p=>p.change>=required);
  });
  const opening=front?[{...front,kind:'dip' as const}]:[];
  const frontPeak=peaks.filter(m=>m.end<=video.durationSeconds*.5).map(m=>({...m,kind:'peak' as const}));
  const intro=frontDrop(video.retention.points,video.durationSeconds,Math.min(120,video.durationSeconds*.5));
  return {opening:intro?[{...intro,kind:'dip' as const}]:[],front:[...opening,...frontPeak],rear:rear.slice(0,1)};
}
export function localPeaks(points:Video['retention']['points'],duration:number,minRatio=.05,maxRatio=.9):Moment[]{
  if(points.length<24)return [];
  const changes=points.slice(1).map((p,i)=>Math.abs(p.value-points[i].value));
  const floor=Math.max(.01,median(changes)*2);
  const ranked:Moment[]=[];
  for(let i=3;i<points.length-3;i++){
    if(points[i].ratio<minRatio||points[i].ratio>maxRatio)continue;
    const before=median(points.slice(i-3,i).map(p=>p.value)),after=median(points.slice(i+1,i+4).map(p=>p.value));
    const prominence=points[i].value-Math.max(before,after);
    if(prominence>floor)ranked.push({index:i,start:points[i-1].ratio*duration,end:points[i].ratio*duration,before:Math.max(before,after),after:points[i].value,drop:prominence*100});
  }
  return ranked.sort((a,b)=>b.drop-a.drop).slice(0,1);
}
export function localMoments(points:Video['retention']['points'],duration:number,minRatio=.05,maxRatio=.9):Moment[]{
  if(points.length<24)return [];
  const windows:Moment[]=[];
  for(let i=3;i+5<points.length;i++){
    // Main story only: opening/ending are reviewed separately, not ranked as faults.
    if(points[i].ratio<minRatio||points[i+5].ratio>maxRatio)continue;
    const before=points.slice(i,i+3).reduce((s,p)=>s+p.value,0)/3,after=points.slice(i+3,i+6).reduce((s,p)=>s+p.value,0)/3;
    windows.push({index:i+5,start:points[i].ratio*duration,end:points[i+5].ratio*duration,before,after,drop:(before-after)*100});
  }
  if(!windows.length)return [];
  const typical=median(windows.map(w=>w.drop)),mad=median(windows.map(w=>Math.abs(w.drop-typical)));
  const ranked=windows.filter(w=>w.drop>Math.max(0,typical)+Math.max(2*mad,.1)).sort((a,b)=>b.drop-a.drop);
  const result:Moment[]=[];
  for(const w of ranked){if(result.every(p=>Math.abs(p.index-w.index)>=6))result.push(w);if(result.length===3)break;}
  return result;
}

export function comparisonFor(video:ReviewVideo,all:CatalogVideo[],period:Period){
  const m=metricsFor(video,period);
  if(!m||m.status!=='ok'||!m.complete||m.engagedViews==null||m.averageViewPercentage==null)return {label:'集計待ち',count:0,median:null,delta:null,reason:'対象期間の指標が揃ってから比較します。'};
  if(!m.engagedViews)return {label:'参考値',count:0,median:null,delta:null,reason:'視聴データが少ないため比較しません。'};
  const pub=video.publishedAt?Date.parse(video.publishedAt):NaN;
  if(!Number.isFinite(pub))return {label:'参考値',count:0,median:null,delta:null,reason:'公開日時がないため、作品間の比較を保留しています。'};
  const age=Math.max(1,(Date.parse(m.endDate)-pub)/86400000);
  const peers=all.filter(v=>{
    const p=metricsFor(v,period);
    if(v.videoId===video.videoId||!v.publishedAt||!p||p.status!=='ok'||!p.complete||p.averageViewPercentage==null||!p.engagedViews)return false;
    const days=Math.abs(Date.parse(v.publishedAt)-pub)/86400000;
    const sameAge=period!=='lifetime'||Math.abs((Date.parse(p.endDate)-Date.parse(v.publishedAt))/86400000-age)<=Math.max(3,age*.3);
    return days<=180&&sameAge&&v.durationSeconds>=video.durationSeconds*.8&&v.durationSeconds<=video.durationSeconds*1.2&&p.engagedViews>=m.engagedViews!*.5&&p.engagedViews<=m.engagedViews!*2&&(v.durationSeconds<=180)===(video.durationSeconds<=180);
  });
  const n=peers.length;
  if(n<10)return {label:'比較対象不足',count:n,median:null,delta:null,reason:`近い尺・公開時期・視聴規模の作品は${n}本。暫定下限10本に届かないため、良否は判定しません。`};
  const value=median(peers.map(v=>metricsFor(v,period)!.averageViewPercentage!));
  return {label:video.publicDateConfirmed&&peers.every(v=>v.publicDateConfirmed)?'条件付き比較':'参考比較',count:n,median:value,delta:m.averageViewPercentage-value,reason:'近い尺（±20%）・公開時期（±180日）・EV規模（0.5〜2倍）の作品と比較。累計は経過日数も近いものに限定。YouTube公開日が基準で、メンバー先行等の一般公開日との一致は未確認です。流入や視聴者層の影響は未補正です。'};
}

export function periodNote(video:ReviewVideo,period:Period){
  const m=metricsFor(video,period);
  if(m)return `${m.startDate==='2000-01-01'?'公開以来':m.startDate}〜${m.endDate}（YouTube集計日・PT）`;
  return period==='lifetime'?'同じ期間の指標を取得中':'期間未満・集計待ち、または対象期間のデータ未取得';
}
