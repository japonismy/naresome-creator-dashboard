'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Play} from 'lucide-react';
import type {Video} from '@/lib/dashboard-schema';
import {localMoments,prioritizedMoments} from '@/lib/review-analysis';
const time=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const percent=(n:number)=>(n*100).toFixed(1)+'%';

export function retentionDrops(video:Video){
  return localMoments(video.retention.points,video.durationSeconds);
}

export default function Retention({video,position,onSeek,player}:{video:Video;position:number;onSeek:(n:number)=>void;player:ReactNode}){
  const [scope,setScope]=useState<'intro'|'front'|'whole'>('intro');
  const zoom=scope==='intro',whole=scope==='whole';
  const [selected,setSelected]=useState<number|null>(null),[hover,setHover]=useState<number|null>(null),[width,setWidth]=useState(650);
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(260,entry.contentRect.width)));observer.observe(el);return()=>observer.disconnect();},[]);
  const points=video.retention.points,moments=useMemo(()=>prioritizedMoments(video),[video]);
  const features=(zoom?moments.opening:whole?[...moments.front,...moments.rear]:moments.front).filter(f=>f.kind==='peak'||f.drop>=3);
  useEffect(()=>{setSelected(null);setHover(null);},[scope]);
  const limit=zoom?Math.min(120,video.durationSeconds):whole?video.durationSeconds:video.durationSeconds/2;
  const visible=points.map((p,index)=>({...p,index,seconds:p.ratio*video.durationSeconds})).filter(p=>p.seconds<=limit);
  const nearest=(s:number)=>visible.reduce((best,p)=>Math.abs(p.seconds-s)<Math.abs(points[best].ratio*video.durationSeconds-s)?p.index:best,visible[0]?.index??0);
  const chosen=hover??selected??(points.length?nearest(position):0),point=points[chosen],prior=points[chosen-1];
  const start=prior?prior.ratio*video.durationSeconds:0,end=point?point.ratio*video.durationSeconds:0;
  const delta=prior&&point?(point.value-prior.value)*100:null;
  const height=245,left=45,right=15,top=22,bottom=36,plotW=width-left-right,plotH=height-top-bottom;
  const maximum=Math.max(1,Math.ceil(Math.max(...points.map(p=>p.value),1)*4)/4);
  const x=(s:number)=>left+s/limit*plotW,y=(v:number)=>top+(1-v/maximum)*plotH;
  const path=visible.map((p,i)=>(i?'L':'M')+x(p.seconds).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
  function pointer(clientX:number,rect:DOMRect){return nearest(Math.max(0,Math.min(limit,(clientX-rect.left-left)/plotW*limit)));}
  function choose(index:number){setSelected(index);setHover(null);onSeek(points[index].ratio*video.durationSeconds);}
  function showFeature(index:number){setSelected(index);setHover(null);const candidate=features.find(d=>d.index===index);onSeek(Math.max(0,(candidate?.start??points[index].ratio*video.durationSeconds)-5));}
  const ticks=Array.from({length:Math.round(maximum/.25)+1},(_,i)=>i*.25);
  return <section className="panel retention-panel">
    <div className="section-heading"><h2>視聴者維持率</h2><span className="scope-label">約{Math.round(video.durationSeconds/100)}秒単位</span></div>
    <div className="segmented retention-scope" aria-label="グラフの範囲">{([['intro','冒頭'],['front','前半'],['whole','全体']] as const).map(([key,label])=><button key={key} className={scope===key?'active':''} aria-pressed={scope===key} onClick={()=>setScope(key)}>{label}</button>)}</div>
    <div className="retention-workspace"><div className="graph-column" ref={container}>
    {points.length?<>
      <div className="graph-readout" aria-live="polite"><strong>{time(start)}–{time(end)}</strong><span>維持率 <strong>{percent(point.value)}</strong></span></div>
      <svg className="retention-graph" viewBox={`0 0 ${width} ${height}`} role="slider" tabIndex={0} aria-label="視聴者維持率と再生位置" aria-valuemin={0} aria-valuemax={Math.round(limit)} aria-valuenow={Math.round(Math.min(position,limit))} aria-valuetext={`${time(start)}から${time(end)}、維持率${percent(point.value)}`} onPointerMove={e=>setHover(pointer(e.clientX,e.currentTarget.getBoundingClientRect()))} onPointerLeave={()=>setHover(null)} onClick={e=>choose(pointer(e.clientX,e.currentTarget.getBoundingClientRect()))} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const at=visible.findIndex(p=>p.index===chosen);const p=visible[Math.max(0,Math.min(visible.length-1,at+(e.key==='ArrowRight'?1:-1)))];if(p)choose(p.index);}}}>
        {ticks.map(t=><g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)"/><text x={left-8} y={y(t)+4} textAnchor="end" fill="var(--chart-label)" fontSize="14">{Math.round(t*100)}%</text></g>)}
        {[0,.25,.5,.75,1].map(t=><text key={t} x={x(t*limit)} y={height-10} textAnchor={t===0?'start':t===1?'end':'middle'} fill="var(--chart-label)" fontSize="14">{time(t*limit)}</text>)}
        {selected!=null&&points[selected].ratio*video.durationSeconds<=limit&&<rect x={x(selected?points[selected-1].ratio*video.durationSeconds:0)} y={top} width={Math.max(3,x(points[selected].ratio*video.durationSeconds)-x(selected?points[selected-1].ratio*video.durationSeconds:0))} height={plotH} fill="var(--chart-selected)"/>}
        <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth="2.5" strokeLinejoin="round"/>
        {features.filter(f=>f.end<=limit).map((d,i)=><g key={d.index} aria-hidden="true"><circle cx={x(d.end)} cy={y(points[d.index].value)} r="10" fill={d.kind==='peak'?'#67e8c6':'#fbbf24'} stroke="var(--surface)" strokeWidth="2"/><text x={x(d.end)} y={y(points[d.index].value)+4} textAnchor="middle" fill="var(--chart-marker-text)" fontSize="14" fontWeight="700">{i+1}</text></g>)}
        {zoom&&visible.map(p=><circle key={p.index} data-testid="measured-sample" cx={x(p.seconds)} cy={y(p.value)} r="3.5" fill="var(--chart-line)"/>)}
        {position<=limit&&<line data-testid="playhead" x1={x(position)} x2={x(position)} y1={top} y2={height-bottom} stroke="var(--chart-playhead)" strokeWidth="1.5" strokeDasharray="4 3"/>}
        {point&&end<=limit&&<g><line x1={x(end)} x2={x(end)} y1={top} y2={height-bottom} stroke="var(--chart-line)" opacity=".65"/><circle cx={x(end)} cy={y(point.value)} r="5" fill="var(--chart-line)" stroke="var(--surface)" strokeWidth="2"/></g>}
      </svg>
      <div className="graph-footer"><span>{zoom?'冒頭2分 · ':''}グラフを押すと再生</span><button className="text-button" onClick={()=>onSeek(Math.max(0,start-5))}><Play size={14}/>少し前から再生</button></div>
    </>:<div className="empty-graph"><h4>維持率データは集計待ちです</h4><p>取得後にグラフと確認ポイントを表示します。</p></div>}
    </div><div className="video-column">{player}</div></div>
    {features.some(f=>f.start<limit)&&<div className="feature-list">{features.filter(f=>f.start<limit).map((f,i)=><button key={f.kind} className={'feature-card '+f.kind+(selected===f.index?' selected':'')} onClick={()=>showFeature(f.index)}><span className="feature-icon">{i+1}</span><span><strong>{f.kind==='dip'?'低下区間を確認':'山の前後を確認'}</strong><small>{time(f.start)}–{time(f.end)}{f.kind==='dip'?' · '+f.drop.toFixed(1)+'ポイント低下':''}</small></span><Play size={18}/></button>)}</div>}
    {selected!=null&&<p className="reflection-prompt">この前後で、話の進み方や見せ方はどう変わった？</p>}
    <div className="review-section-footer"><details className="data-note"><summary>グラフの見方</summary><p>冒頭から確認し、気になる位置を押して再生してください。山は見返しやスキップ先、谷はスキップや視聴終了などの候補です。原因や良し悪しは、動画・台本・コメントを照らし合わせて振り返ります。</p><p>累計・100区間のデータ（約{Math.round(video.durationSeconds/100)}秒単位）。表示値は取得区間の値で、正確な離脱秒や30秒時点の値ではありません。低下ポイントは隣接する取得区間の差（後半候補は前後の区間平均の差）です。3ポイント未満の低下は確認ボタンを出していません。候補はサイト独自の抽出で、Studioの判定とは異なります。{video.retention.status==='stale'?'前回のデータです。':''}</p><a href="https://support.google.com/youtube/answer/9314415?hl=ja" target="_blank" rel="noopener noreferrer">YouTube公式：視聴者維持率の見方 ↗</a></details></div>
  </section>;
}
