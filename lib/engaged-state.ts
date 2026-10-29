import type {Video} from './dashboard-schema';

/** Suppress preserved Sheet values when the Analytics report has no result.
 * Apply on read so immutable snapshots and their checksums remain unchanged. */
export function normalizeEngaged(video:Video):Video{
  const lifetime=video.reviewMetrics?.lifetime;
  const missingReport=video.reviewMetrics!==undefined&&(!lifetime||lifetime.status==='pending'||lifetime.status==='missing'||lifetime.engagedViews===null);
  const pending=video.engagedViews===null||missingReport;
  if(video.engaged.status==='ok'&&!pending)return video;
  return {...video,engagedViews:null,engaged:{...video.engaged,status:video.engaged.status==='ok'?'pending':video.engaged.status}};
}
