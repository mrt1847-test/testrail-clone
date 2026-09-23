from pathlib import Path
import hashlib,json,os,datetime,subprocess
src=Path('C:/Users/cease/OneDrive/문서/GitHub/testrail-clone'); snap=Path(os.environ['TEMP'])/'e2e-review-20260921-16c6'; out=Path('docs/ux-evidence')
files=[]
for base in ['apps','packages']:
 for p in (snap/base).rglob('*'):
  if not p.is_file() or 'node_modules' in p.parts or p.suffix not in ['.ts','.tsx','.json','.js']: continue
  r=p.relative_to(snap); o=src/r; w=Path(r)
  def h(f): return hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else None
  files.append({'path':r.as_posix(),'snapshot':h(p),'original':h(o),'worktree':h(w)})
for name in ['NEXT_ACTIONS.md','USABILITY_REALIGNMENT_2026-09-18.md','CASE_AUTHORING_FLOW_REVIEW_2026-09-20.md']:
 p=src/'docs'/name
 files.append({'path':'docs/'+name,'original':hashlib.sha256(p.read_bytes()).hexdigest()})
out.joinpath('e2e-0921-baseline.json').write_text(json.dumps({'at':datetime.datetime.now().isoformat(),'revision':'cea2fd676156969d2442b5eef3e7c9026465cf7b','files':files},indent=2))
print('baseline',len(files),'files; source differences',sum(x.get('snapshot')!=x.get('worktree') for x in files if 'snapshot' in x))
