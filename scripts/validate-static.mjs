import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {z} from 'zod';
import {headerSchema,videoSchema} from '../lib/dashboard-schema.ts';
const directory=path.resolve(process.argv[2]);
if(fs.lstatSync(directory).isSymbolicLink())throw Error('Release directory symlinks forbidden');
const allowedStatus=z.enum(['ok','pending','missing','disabled','forbidden','error','stale']);
const ref=z.object({path:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const manifestSchema=z.object({schemaVersion:z.literal(1),runId:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),generatedAt:z.string().datetime({offset:true}),exportedAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),videoCount:z.number().int().min(1).max(1000),catalog:ref,videos:z.record(ref)}).strict();
const manifest=manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8')));
if(Date.parse(manifest.expiresAt)<=Date.now())throw Error('Release expired');
if(Date.parse(manifest.generatedAt)>Date.now()+300000||Date.parse(manifest.expiresAt)>Date.parse(manifest.generatedAt)+29*86400000||manifest.catalog.path!==`runs/${manifest.runId}/catalog.json`)throw Error('Invalid release freshness or catalog path');
const expected=new Set(['manifest.json']);
function load(ref){
 if(!ref.path.startsWith('runs/'+manifest.runId+'/')||!/^runs\/[a-zA-Z0-9_-]{8,100}\/(?:catalog\.json|videos\/[\w-]{11}\.json)$/.test(ref.path))throw Error('Invalid release file path');
 expected.add(ref.path);const file=path.join(directory,ref.path);if(fs.lstatSync(file).isSymbolicLink())throw Error('Release symlinks forbidden');const data=fs.readFileSync(file);
 if(crypto.createHash('sha256').update(data).digest('hex')!==ref.sha256)throw Error('Release checksum mismatch');
 return JSON.parse(data.toString('utf8'));
}
const catalogSchema=z.object({header:headerSchema,videos:z.array(videoSchema.innerType().omit({comments:true,retention:true}).extend({retentionStatus:allowedStatus,commentsStatus:allowedStatus,storedComments:z.number().int().min(0).max(100)}).strict()).max(1000),sync:z.object({status:z.literal('ok')}).strict()}).strict();
const catalog=catalogSchema.parse(load(manifest.catalog));
const ids=catalog.videos.map(v=>v.videoId);
if(new Set(ids).size!==ids.length||new Set(catalog.videos.map(v=>v.productionNo)).size!==ids.length||ids.length!==manifest.videoCount||Object.keys(manifest.videos).length!==ids.length||catalog.header.runId!==manifest.runId||catalog.header.videoCount!==ids.length)throw Error('Catalog identity mismatch');
for(const id of ids){
 const file=manifest.videos[id];if(!file||file.path!==`runs/${manifest.runId}/videos/${id}.json`)throw Error('Missing video');
 const data=z.object({header:headerSchema,video:videoSchema}).strict().parse(load(file));
 if(data.header.runId!==manifest.runId||data.video.videoId!==id||JSON.stringify(data.header)!==JSON.stringify(catalog.header))throw Error('Mixed generation');
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),relative=path.relative(directory,file).split(path.sep).join('/');if(entry.isSymbolicLink())throw Error('Release symlinks forbidden');if(entry.isDirectory()){if(![...expected].some(p=>p.startsWith(relative+'/')))throw Error('Unexpected public directory');walk(file);}else if(!expected.has(relative))throw Error('Unexpected public file');}}
walk(directory);
console.log(JSON.stringify({valid:true,runId:manifest.runId,count:ids.length,files:expected.size}));
