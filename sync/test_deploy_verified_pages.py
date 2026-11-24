import contextlib,io,json,os,runpy,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
SCRIPT=Path(__file__).with_name('deploy_verified_pages.py')
class DeployTests(unittest.TestCase):
 def execute(self,artifacts):
  calls=[];output=io.StringIO()
  def request(req,timeout):
   calls.append(req)
   if '/artifacts?' in req.full_url:data={'artifacts':artifacts}
   elif req.full_url=='https://oidc.example/token':data={'value':'private-oidc'}
   elif req.data:data={'id':'deployment1'}
   else:data={'status':'succeed'}
   return io.BytesIO(json.dumps(data).encode())
  with tempfile.TemporaryDirectory() as tmp:
   env={'GITHUB_REPOSITORY':'japonismy/naresome-creator-dashboard','GITHUB_RUN_ID':'123','GITHUB_SHA':'a'*40,'GH_TOKEN':'private-gh','ACTIONS_ID_TOKEN_REQUEST_URL':'https://oidc.example/token','ACTIONS_ID_TOKEN_REQUEST_TOKEN':'private-req','GITHUB_OUTPUT':str(Path(tmp)/'out')}
   with patch.dict(os.environ,env),patch('urllib.request.urlopen',request),contextlib.redirect_stdout(output):runpy.run_path(str(SCRIPT),run_name='__main__')
  return calls,output.getvalue()
 def test_verified_id_and_oidc_used_without_logging_secrets(self):
  calls,log=self.execute([{'id':17,'name':'github-pages','expired':False,'size_in_bytes':1024}])
  posts=[json.loads(r.data) for r in calls if r.data]
  self.assertEqual(posts[0]['artifact_id'],17)
  self.assertEqual(posts[0]['oidc_token'],'private-oidc')
  self.assertNotIn('private-',log)
  self.assertFalse(any('twirp' in r.full_url for r in calls))
 def test_missing_or_ambiguous_artifact_blocks_deploy(self):
  for rows in [[],[{'id':1,'name':'github-pages','expired':False,'size_in_bytes':1}]*2]:
   with self.assertRaises(ValueError):self.execute(rows)
if __name__=='__main__':unittest.main()
