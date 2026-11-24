"""Bounded readback only; never repeat a deployment or a data collection."""
import json,os,time
from check_public_freshness import check
last=None
for attempt in range(21):
    try:
        result=check(os.environ['EXPECTED_RUN_ID'])
        print(json.dumps(result));break
    except Exception as exc:
        last=str(exc)
        print(json.dumps({'readback_attempt':attempt+1,'status':'waiting','reason':last}),flush=True)
        if attempt<20:time.sleep(30)
else:raise SystemExit('Public readback failed: '+last)
