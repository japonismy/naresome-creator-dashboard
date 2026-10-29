"""Fail closed after a public release expires, even when the PC is offline."""
import argparse,json,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone

def main():
 p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--github-output',type=Path,required=True);a=p.parse_args()
 if not a.base.startswith('https://japonismy.github.io/'):raise ValueError('Unexpected site origin')
 req=urllib.request.Request(a.base.rstrip('/')+'/data/manifest.json',headers={'Cache-Control':'no-cache'})
 try:
  with urllib.request.urlopen(req,timeout=30) as response:raw=response.read(262145)
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
  raw=b'{}'
 if len(raw)>262144:raise ValueError('Manifest too large')
 m=json.loads(raw);expires=m.get('expiresAt');ready=bool(expires and not m.get('expired') and datetime.fromisoformat(expires.replace('Z','+00:00'))<=datetime.now(timezone.utc))
 with a.github_output.open('a',encoding='utf-8') as f:f.write('expired='+str(ready).lower()+'\n')
 if not ready:return
 if a.output.exists() and any(a.output.iterdir()):raise ValueError('Expiry artifact must start empty')
 (a.output/'data').mkdir(parents=True)
 (a.output/'index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>制作レビュー</title><body style="background:#0f0f0f;color:#f1f1f1;font:18px/1.8 sans-serif;padding:32px"><h1>制作レビュー</h1><p>データの更新を待っています。更新後にもう一度開いてください。</p></body></html>',encoding='utf-8')
 (a.output/'data/manifest.json').write_text(json.dumps({'schemaVersion':1,'expired':True,'runId':'expired','generatedAt':m['generatedAt'],'expiredAt':datetime.now(timezone.utc).isoformat()}),encoding='utf-8')
 (a.output/'.nojekyll').write_text('')

if __name__=='__main__':main()
