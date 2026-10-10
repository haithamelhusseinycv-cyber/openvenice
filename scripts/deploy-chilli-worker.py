from pathlib import Path
import time, os, configparser, hashlib, json, mimetypes, re, requests
from urllib.parse import urlsplit
root=Path(__file__).resolve().parents[1]
home=Path('/data/data/com.termux/files/home')
config=configparser.ConfigParser()
config.read(home/'.config/rclone/rclone.conf')
endpoints=[config.get(section,'endpoint',fallback='') for section in config.sections()]
account=None
for endpoint in endpoints:
 parsed=urlsplit(endpoint)
 match=re.fullmatch(r'([0-9a-f]{32})[.]r2[.]cloudflarestorage[.]com',parsed.hostname or '')
 if parsed.scheme=='https' and match and not parsed.username and not parsed.password and parsed.port in (None,443) and parsed.path in ('','/') and not parsed.query and not parsed.fragment:
  account=match.group(1)
  break
if account is None:raise ValueError('No valid Cloudflare R2 account endpoint configured')
token=(home/'.config/cloudflare-workers-token').read_text().strip()
headers={'Authorization':'Bearer '+token}
name=os.environ.get('CHILLI_WORKER_NAME','chilli-production')
files={}
imports=[];entries=[]
for i,path in enumerate(sorted((root/'dist').rglob('*'))):
 if not path.is_file() or path.suffix=='.map':continue
 data=path.read_bytes(); asset='/'+path.relative_to(root/'dist').as_posix()
 module='asset'+str(i)+'.bin'
 files[module]=(module,data,'application/octet-stream')
 imports.append('import a'+str(i)+' from "./'+module+'";')
 mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
 if path.suffix=='.js':mime='application/javascript'
 entries.append(json.dumps(asset)+': [a'+str(i)+','+json.dumps(mime)+','+json.dumps(hashlib.sha256(data).hexdigest())+']')
worker='\n'.join(imports)+'\nconst files={'+','.join(entries)+'};'+'''
export default { async fetch(request) {
 const proxied = await handleVeniceSession(request);
 if (proxied) return proxied;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const path=new URL(request.url).pathname;
 const file=files[path] || (!path.split('/').pop().includes('.')?files['/index.html']:undefined);
 if(!file)return new Response('Not found',{status:404});
 const headers={'Content-Type':file[1],'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','ETag':'"'+file[2]+'"','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' blob: data: https://api.venice.ai ws://127.0.0.1:8299 http://127.0.0.1:8298 http://127.0.0.1:8807 http://127.0.0.1:8806 http://127.0.0.1:8810; img-src 'self' data: blob: https: http://127.0.0.1:8298; media-src 'self' blob: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'X-Frame-Options':'DENY','Strict-Transport-Security':'max-age=31536000','Permissions-Policy':'camera=(), microphone=(self), geolocation=()','Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'};
 if(request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:file[0],{headers});
}};
'''
worker=(root/'scripts/venice-session-proxy.mjs').read_text()+worker
files['worker.js']=('worker.js',worker,'application/javascript+module')
files['metadata']=(None,json.dumps({'main_module':'worker.js','compatibility_date':'2026-10-08'}),'application/json')
base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name
response=requests.put(base,headers=headers,files=files,timeout=90);result=response.json()
if not result.get('success'):raise RuntimeError(json.dumps(result.get('errors')))
response=requests.post(base+'/subdomain',headers=headers,json={'enabled':True},timeout=30)
if not response.json().get('success'):raise RuntimeError('Could not enable production domain')
url='https://'+name+'.haitham-elhusseiny-cv.workers.dev'
expected_assets=re.findall(r'(?:src|href)="(/assets/[^\"]+)"',(root/'dist/index.html').read_text())
assert expected_assets
for attempt in range(12):
 live=requests.get(url,timeout=30)
 assets=re.findall(r'(?:src|href)="(/assets/[^\"]+)"',live.text)
 if live.status_code==200 and assets==expected_assets:
  if all(requests.get(url+asset,timeout=30).status_code==200 for asset in assets):break
 time.sleep(5)
else:raise RuntimeError('Published Worker did not serve the expected entry assets')
print('DEPLOYED',url,'ASSETS',len(files)-2,'VERIFIED ENTRY ASSETS',len(assets))
