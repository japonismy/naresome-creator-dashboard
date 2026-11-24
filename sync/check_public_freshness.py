"""Read-only end-to-end freshness/hash check. Never runs collectors or paid retries."""
import argparse,hashlib,json,re,urllib.request
from datetime import datetime,timezone,timedelta
BASE='https://japonismy.github.io/naresome-creator-dashboard/'
def check(expected_run=None,now=None,fetch=None):
    now=now or datetime.now(timezone.utc)
    def download(path):
        req=urllib.request.Request(BASE+path,headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(req,timeout=30) as r:return r.read(8*1024*1024)
    fetch=fetch or download
    m=json.loads(fetch('data/manifest.json?_verify='+str(int(now.timestamp()))))
    if expected_run and m.get('runId')!=expected_run:raise ValueError('Public run differs from completed collection')
    generated=datetime.fromisoformat(m['generatedAt'].replace('Z','+00:00'))
    if generated>now+timedelta(minutes=5):raise ValueError('Public collection timestamp is in the future')
    if datetime.fromisoformat(m['expiresAt'].replace('Z','+00:00'))<=now:raise ValueError('Public API data expired')
    if expected_run:
        if now-generated>timedelta(hours=1):raise ValueError('Newly published collection is over one hour old')
    else:
        jst=now.astimezone(timezone(timedelta(hours=9)))
        deadlines=[jst.replace(hour=h,minute=10,second=0,microsecond=0)+timedelta(days=d) for d in [-1,0] for h in [2,14]]
        due=max(t for t in deadlines if t+timedelta(hours=1)<=jst)
        if generated<due:raise ValueError('Scheduled collection/publication is overdue')
    ref=m['catalog'];path=ref['path']
    if not re.fullmatch(r'runs/[A-Za-z0-9_-]+/catalog\.json',path) or path!=f"runs/{m['runId']}/catalog.json":raise ValueError('Invalid catalog path')
    raw=fetch('data/'+path)
    if hashlib.sha256(raw).hexdigest()!=ref['sha256']:raise ValueError('Public catalog hash differs')
    c=json.loads(raw)
    if c['header']['runId']!=m['runId'] or c['header']['generatedAt']!=m['generatedAt'] or len(c['videos'])!=m['videoCount']:raise ValueError('Public generation/count/timestamp differs')
    return {'status':'ok','checked_at':now.isoformat(),'run_id':m['runId'],'collected_at':m['generatedAt'],'video_count':m['videoCount'],'readback_verified':True}
def main():
    from pathlib import Path
    p=argparse.ArgumentParser();p.add_argument('--expected-run');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    try:result=check(a.expected_run)
    except Exception as e:result={'status':'error','checked_at':datetime.now(timezone.utc).isoformat(),'error':str(e)}
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
    return 0 if result['status']=='ok' else 1
if __name__=='__main__':raise SystemExit(main())
