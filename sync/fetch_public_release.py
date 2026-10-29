"""Download one bounded, immutable public release from private GCS; never query BigQuery."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import subprocess
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime,timezone,timedelta
from pathlib import Path,PurePosixPath

ARCHIVE_LIMIT=12*1024*1024
EXPANDED_LIMIT=16*1024*1024
FILE_LIMIT=4*1024*1024

def request(url,limit,token=None):
    headers={'User-Agent':'naresome-public-release','Cache-Control':'no-cache'}
    if token:headers['Authorization']='Bearer '+token
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90) as response:
        data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Download exceeded the approved byte limit')
    return data

def extract(archive:Path,output:Path,run_id:str):
    if output.exists() and any(output.iterdir()):raise ValueError('Extraction destination must be new or empty')
    entries=[];total=0
    with tarfile.open(archive,'r:gz') as tar:
        for entry in tar:
            name=entry.name;parts=PurePosixPath(name).parts
            if len(entries)>=1002 or not entry.isfile() or '\\' in name or name.startswith('/') or '..' in parts or '.' in parts or not parts:raise ValueError('Unsafe archive entry')
            allowed=name=='manifest.json' or bool(re.fullmatch(re.escape('runs/'+run_id+'/')+r'(catalog\.json|videos/[\w-]{11}\.json)',name))
            if not allowed or entry.size<0 or entry.size>FILE_LIMIT or any(item.name==name for item in entries):raise ValueError('Unexpected archive entry')
            total+=entry.size
            if total>EXPANDED_LIMIT:raise ValueError('Expanded archive exceeds 16 MiB')
            entries.append(entry)
        output.mkdir(parents=True,exist_ok=True)
        for entry in entries:
            target=output/entry.name
            if not target.resolve().is_relative_to(output.resolve()):raise ValueError('Archive path escapes destination')
            target.parent.mkdir(parents=True,exist_ok=True)
            source=tar.extractfile(entry)
            if source is None:raise ValueError('Missing archive body')
            data=source.read(entry.size+1)
            if len(data)!=entry.size:raise ValueError('Archive body size mismatch')
            with target.open('xb') as handle:handle.write(data)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--prefix',required=True);parser.add_argument('--run-id',required=True);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--live-base');parser.add_argument('--github-output',type=Path)
    args=parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}',args.run_id):raise ValueError('Invalid run id')
    if not re.fullmatch(r'gs://[a-z0-9][a-z0-9._-]+/[A-Za-z0-9/_-]+',args.prefix.rstrip('/')):raise ValueError('Invalid release prefix')
    def ready(value):
        if args.github_output:
            with args.github_output.open('a',encoding='utf-8') as handle:handle.write('ready='+('true' if value else 'false')+'\n')
    # Avoid GCS downloads on ordinary manual reruns, and reject older releases.
    live=None
    if args.live_base:
        parsed=urllib.parse.urlparse(args.live_base)
        if parsed.scheme!='https':raise ValueError('Live site must use HTTPS')
        try:live=json.loads(request(args.live_base.rstrip('/')+'/data/manifest.json',256*1024))
        except urllib.error.HTTPError as error:
            if error.code!=404:raise
        if live and live.get('runId')==args.run_id:
            ready(False);print(json.dumps({'skipped':'already_published','runId':args.run_id}));return
    token_result=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,check=True)
    token=token_result.stdout.strip()
    if not token:raise ValueError('GCS credentials unavailable')
    prefix=args.prefix.rstrip('/')[5:];bucket,folder=prefix.split('/',1)
    def download(name,limit):
        obj=folder+'/'+args.run_id+'/'+name
        url='https://storage.googleapis.com/storage/v1/b/'+urllib.parse.quote(bucket,safe='')+'/o/'+urllib.parse.quote(obj,safe='')
        metadata=json.loads(request(url+'?fields=size,generation',4096,token))
        size=int(metadata['size']);generation=str(metadata['generation'])
        if size<1 or size>limit or not generation.isdigit():raise ValueError('Object exceeds approved size')
        body=request(url+'?alt=media&generation='+generation,limit,token)
        if len(body)!=size:raise ValueError('GCS object size mismatch')
        return body
    release=json.loads(download('release.json',64*1024))
    if release.get('schemaVersion')!=1 or release.get('runId')!=args.run_id:raise ValueError('Release identity mismatch')
    expiry=datetime.fromisoformat(release['expiresAt'].replace('Z','+00:00'))
    if expiry<=datetime.now(timezone.utc):raise ValueError('Release expired')
    captured=datetime.fromisoformat(release['capturedAt'].replace('Z','+00:00'))
    anchor=datetime.fromisoformat(release['retentionAnchor'].replace('Z','+00:00'))
    if expiry>anchor+timedelta(days=29) or expiry>captured+timedelta(days=29):raise ValueError('Release retention window was extended')
    if live and datetime.fromisoformat(live['generatedAt'].replace('Z','+00:00'))>captured:raise ValueError('Refusing older public generation')
    ref=release['archive']
    if ref.get('name')!='public-data.tar.gz' or not re.fullmatch(r'[a-f0-9]{64}',ref.get('sha256','')) or not isinstance(ref.get('bytes'),int) or not 0<ref['bytes']<=ARCHIVE_LIMIT:raise ValueError('Invalid archive reference')
    data=download('public-data.tar.gz',ARCHIVE_LIMIT)
    if len(data)!=ref['bytes'] or hashlib.sha256(data).hexdigest()!=ref['sha256']:raise ValueError('Archive checksum mismatch')
    archive=args.output.parent/(args.run_id+'.tar.gz')
    archive.parent.mkdir(parents=True,exist_ok=True)
    with archive.open('xb') as handle:handle.write(data)
    extract(archive,args.output,args.run_id)
    manifest=json.loads((args.output/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('runId')!=release['runId'] or manifest.get('expiresAt')!=release['expiresAt'] or manifest.get('generatedAt')!=release['capturedAt']:raise ValueError('Archive manifest mismatch')
    ready(True);print(json.dumps({'runId':args.run_id,'archiveBytes':len(data),'objectsDownloaded':2,'metadataReads':2}))

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('Public release download/validation failed; no retry or partial publication performed.')
