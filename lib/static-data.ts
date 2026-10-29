import type {CatalogVideo,Header,Video} from './dashboard-schema';

type FileRef={path:string;sha256:string};
type PublicManifest={schemaVersion:1;runId:string;generatedAt:string;expiresAt:string;catalog:FileRef;videos:Record<string,FileRef>};
type Catalog={videos:CatalogVideo[];header:Header|null;sync:{status:string}|null};
declare global {interface Window {__NARESOME_STATIC__?:{manifestUrl:string;homeUrl:string};}}
let pinned:PublicManifest|null=null;

export function dashboardHome(){return typeof window!=='undefined'&&window.__NARESOME_STATIC__?window.__NARESOME_STATIC__.homeUrl:'/';}
function config(){return typeof window!=='undefined'?window.__NARESOME_STATIC__:undefined;}
function ensureFresh(m:PublicManifest){if(!Number.isFinite(Date.parse(m.expiresAt))||Date.now()>=Date.parse(m.expiresAt))throw Error('表示データの有効期限が切れています。更新後に再読み込みしてください。');}
function fileUrl(ref:FileRef,m:PublicManifest){
 const settings=config();if(!settings)throw Error('静的データの設定がありません。');
 const root=new URL('.',settings.manifestUrl),url=new URL(ref.path,root);
 if(url.origin!==root.origin||!url.href.startsWith(root.href)||!ref.path.startsWith('runs/'+m.runId+'/')||!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('表示データの参照先が不正です。');
 return url;
}
async function verified<T>(ref:FileRef,m:PublicManifest):Promise<T>{
 ensureFresh(m);const response=await fetch(fileUrl(ref,m),{cache:'force-cache'});if(!response.ok)throw Error('表示データを取得できませんでした。ページを再読み込みしてください。');
 const buffer=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==ref.sha256)throw Error('表示データの整合性を確認できませんでした。');
 return JSON.parse(new TextDecoder().decode(buffer)) as T;
}
export async function fetchCatalog():Promise<Catalog>{
 const settings=config();
 if(!settings){const r=await fetch('/api/catalog',{cache:'no-store'});if(!r.ok)throw Error('一覧を取得できませんでした。');return r.json() as Promise<Catalog>;}
 const response=await fetch(settings.manifestUrl,{cache:'no-store'});if(!response.ok)throw Error('一覧を取得できませんでした。');
 const m=await response.json() as PublicManifest;
 if(m.schemaVersion!==1||!/^[a-zA-Z0-9_-]{8,100}$/.test(m.runId)||!m.catalog||!m.videos)throw Error('表示データの形式が不正です。');
 ensureFresh(m);const data=await verified<Catalog>(m.catalog,m);if(data.header?.runId!==m.runId)throw Error('表示データの世代が一致しません。');
 pinned=m;return data;
}
export async function fetchVideo(id:string):Promise<{video:Video;header:Header}>{
 if(!/^[\w-]{11}$/.test(id))throw Error('動画が見つかりません。');
 if(!config()){const r=await fetch('/api/videos/'+id,{cache:'no-store'});if(!r.ok)throw Error('動画を取得できませんでした。');return r.json() as Promise<{video:Video;header:Header}>;}
 if(!pinned||!pinned.videos[id])throw Error('動画が見つかりません。ページを再読み込みしてください。');
 const data=await verified<{video:Video;header:Header}>(pinned.videos[id],pinned);
 if(data.header.runId!==pinned.runId||data.video.videoId!==id)throw Error('表示データの世代が一致しません。');
 // A tab can remain open across refreshes; never display comment text beyond its retention window.
 const fetched=data.video.comments.fetchedAt;
 if(!fetched||Date.now()-Date.parse(fetched)>=30*86400000)data.video.comments={...data.video.comments,status:'stale',items:[]};
 return data;
}
