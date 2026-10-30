import { z } from 'zod';
const nullableCount = z.number().int().nonnegative().nullable();
const dateTime = z.string().datetime({ offset: true });
const status = z.enum(['ok', 'pending', 'missing', 'disabled', 'forbidden', 'error', 'stale']);
const group = z.object({status, fetchedAt: dateTime.nullable(), availableThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()}).strict();
const reviewWindow=z.object({status,fetchedAt:dateTime,availableThrough:z.string(),startDate:z.string(),endDate:z.string(),complete:z.boolean(),views:nullableCount,engagedViews:nullableCount,averageViewDuration:z.number().nonnegative().nullable(),averageViewPercentage:z.number().nonnegative().nullable(),likes:nullableCount,comments:nullableCount,watchedMinutes:z.number().nonnegative().nullable(),reach:z.object({impressions:nullableCount,ctr:z.number().min(0).max(100).nullable(),startDate:z.string(),endDate:z.string(),source:z.literal('reporting-cache')}).strict().nullable().optional()}).strict();
const safeScript = z.string().url().refine((s) => {const u=new URL(s);return u.protocol==='https:'&&['docs.google.com','drive.google.com'].includes(u.hostname);}).nullable();
export const videoSchema = z.object({
  videoId:z.string().regex(/^[\w-]{11}$/), productionNo:z.number().int().positive(),
  title:z.string().max(500),writer:z.string().max(150),editor:z.string().max(150),scriptUrl:safeScript,
  publishedAt:dateTime.nullable(),publicDateConfirmed:z.boolean(),durationSeconds:z.number().positive(),embeddable:z.boolean(),
  views:nullableCount,likes:nullableCount,commentCount:nullableCount,engagedViews:nullableCount,
  averageViewDuration:z.number().nonnegative().nullable(),averageViewPercentage:z.number().nonnegative().nullable(),
  metadataFetchedAt:dateTime,engaged:group,average:group,
  reviewMetrics:z.object({processedThrough:z.string(),lifetime:reviewWindow.nullable(),days7:reviewWindow.nullable(),days28:reviewWindow.nullable()}).strict().optional(),
  retention:group.extend({points:z.array(z.object({ratio:z.number().positive().max(1),value:z.number().nonnegative()}).strict()).max(100)}).strict(),
  comments:group.extend({items:z.array(z.object({id:z.string().max(200),text:z.string().max(30000),likes:z.number().int().nonnegative(),publishedAt:dateTime}).strict()).max(100)}).strict(),
}).strict().superRefine((v,ctx)=>{
  if(v.retention.status==='ok'&&v.retention.points.length!==100)ctx.addIssue({code:'custom',message:'Retention must have 100 points'});
  if(v.retention.points.some((p,i,a)=>i>0&&p.ratio<=a[i-1].ratio))ctx.addIssue({code:'custom',message:'Retention ratios must increase'});
});
export type Video=z.infer<typeof videoSchema>;
export const headerSchema=z.object({
  memberDirectory:z.object({writers:z.array(z.string().max(150)).max(100),editors:z.array(z.string().max(150)).max(100)}).strict().optional(),
  schemaVersion:z.literal(1),runId:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),channelId:z.literal('UCaltBBIFhAqt8_ECttdKgsw'),generatedAt:dateTime,
  engagedThrough:z.string().nullable(),videoCount:z.number().int().min(1).max(1000),checksum:z.string().regex(/^[a-f0-9]{64}$/),warnings:z.array(z.string().max(500)).max(100),
  visibility:z.array(z.object({videoId:z.string().regex(/^[\w-]{11}$/),status:z.enum(['public','hidden'])}).strict()).max(1200),
}).strict();
export const uploadSchema=z.object({header:headerSchema,videos:z.array(z.object({hash:z.string().regex(/^[a-f0-9]{64}$/),json:z.string().max(800000)}).strict()).max(10)}).strict();
export type Header=z.infer<typeof headerSchema>;
export type CatalogVideo=Omit<Video,'comments'|'retention'>&{retentionStatus:Video['retention']['status'];commentsStatus:Video['comments']['status'];storedComments:number;retentionFetchedAt?:string|null;curveSummary?:{opening:number|null;front:number|null};reviewMoments?:{index:number;start:number;end:number;before:number;after:number;drop:number}[]};
