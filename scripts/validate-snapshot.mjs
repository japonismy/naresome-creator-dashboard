import fs from 'node:fs';
import {headerSchema,videoSchema} from '../lib/dashboard-schema.ts';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
headerSchema.parse(input.header);
if(!Array.isArray(input.videos)||input.videos.length!==input.header.videoCount)throw Error('snapshot count mismatch');
for(const video of input.videos)videoSchema.parse(video);
console.log(JSON.stringify({valid:true,count:input.videos.length}));
