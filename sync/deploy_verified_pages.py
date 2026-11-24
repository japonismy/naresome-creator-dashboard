"""Deploy this run's verified artifact through the documented Pages REST API.

Uses the same artifact/OIDC contract as actions/deploy-pages. Avoids a failing
internal artifact listing when the public Actions REST listing contains it.
Never print credentials, OIDC tokens, or request payloads containing them.
"""
import json,os,time,urllib.request
repo=os.environ['GITHUB_REPOSITORY'];run=os.environ['GITHUB_RUN_ID']
if repo!='japonismy/naresome-creator-dashboard':raise ValueError('Unexpected repository')
def api(path,body=None):
    raw=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request('https://api.github.com/repos/'+repo+'/'+path,data=raw,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)
rows=api('actions/runs/'+run+'/artifacts?per_page=100')['artifacts']
found=[r for r in rows if r['name']=='github-pages' and not r['expired']]
if len(found)!=1 or found[0]['size_in_bytes']>16*1024*1024:raise ValueError('Missing/ambiguous/oversize Pages artifact')
req=urllib.request.Request(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'],headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
with urllib.request.urlopen(req,timeout=30) as response:oidc=json.load(response)['value']
deployment=api('pages/deployments',{'artifact_id':found[0]['id'],'pages_build_version':os.environ['GITHUB_SHA'],'oidc_token':oidc})
identifier=str(deployment.get('id') or deployment.get('status_url','').rstrip('/').rsplit('/',1)[-1] or os.environ['GITHUB_SHA'])
for attempt in range(60):
    state=api('pages/deployments/'+identifier)['status'];print(json.dumps({'deployment_id':identifier,'status':state}),flush=True)
    if state=='succeed':break
    if state in ['deployment_failed','deployment_perms_error','deployment_content_failed','deployment_cancelled','deployment_lost']:raise SystemExit('Pages deployment failed: '+state)
    time.sleep(5)
else:raise SystemExit('Pages deployment status timed out; no automatic redispatch')
with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('page_url=https://japonismy.github.io/naresome-creator-dashboard/\n')
