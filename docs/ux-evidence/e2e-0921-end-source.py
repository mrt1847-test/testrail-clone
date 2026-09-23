from pathlib import Path
import json,hashlib,datetime,subprocess,os
out=Path('docs/ux-evidence');src=Path('C:/Users/cease/OneDrive/문서/GitHub/testrail-clone');snap=Path(os.environ['TEMP'])/'e2e-review-20260921-16c6';base=json.loads((out/'e2e-0921-baseline.json').read_text());drift=[];meaning=[]
for x in base['files']:
 p=src/x['path'];h=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
 if h!=x.get('original'):drift.append({'path':x['path'],'baseline':x.get('original'),'now':h})
 if 'snapshot' in x:
  p=snap/x['path'];w=Path(x['path'])
  if p.exists() and (not w.exists() or p.read_bytes().replace(b'\r\n',b'\n')!=w.read_bytes().replace(b'\r\n',b'\n')):meaning.append(x['path'])
status=subprocess.check_output(['git','-c','safe.directory=*','-C',str(src),'status','--short'],text=True,encoding='utf-8')
(out/'e2e-0921-end-source.json').write_text(json.dumps({'at':datetime.datetime.now().isoformat(),'drift':drift,'snapshotVsWorktreeNormalized':meaning,'originalGitStatus':status},ensure_ascii=False,indent=2),encoding='utf-8');print('drift',drift);print('normalized differences',meaning)
