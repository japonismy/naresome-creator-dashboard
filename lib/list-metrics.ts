import type {CatalogVideo,Video} from './dashboard-schema';
export function listAverages(video:CatalogVideo|Video){
  const lifetime=video.reviewMetrics?.lifetime;
  if(video.reviewMetrics!==undefined){
    if(!lifetime||lifetime.status!=='ok'||!lifetime.complete)return {percentage:null,duration:null};
    return {percentage:lifetime.averageViewPercentage,duration:lifetime.averageViewDuration};
  }
  return video.average.status==='ok'?{percentage:video.averageViewPercentage,duration:video.averageViewDuration}:{percentage:null,duration:null};
}
export type ListSort='new'|'number'|'engaged'|'views'|'percentage'|'duration'|'likes'|'comments';
export function sortList(videos:CatalogVideo[],sort:ListSort){
  const metric=(v:CatalogVideo)=>sort==='number'?v.productionNo:sort==='engaged'?v.engagedViews:sort==='views'?v.views:sort==='likes'?v.likes:sort==='comments'?v.commentCount:sort==='percentage'?listAverages(v).percentage:listAverages(v).duration;
  return [...videos].sort((a,b)=>{
    const byDate=(b.publishedAt||'').localeCompare(a.publishedAt||'');
    if(sort==='new')return byDate||b.productionNo-a.productionNo;
    const av=metric(a),bv=metric(b);
    if(av==null&&bv==null)return byDate;
    if(av==null)return 1;if(bv==null)return -1;
    return bv-av||byDate||b.productionNo-a.productionNo;
  });
}
