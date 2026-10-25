"""Run from repository root. Prints counts and offending paths only; never credentials.
This is an exact known-local-credential check, not a general secret detector or image OCR.
"""
from pathlib import Path
import json
root=Path.cwd(); secrets=[]
for environment in ['local','test']:
    private=root/'.rise-infra'/environment
    state=json.loads((private/'state.json').read_text())
    status=json.loads((private/'admin-status.json').read_text())
    signing=json.loads((private/'supabase/signing_keys.json').read_text())
    secrets.extend(state['passwords'].values())
    secrets.extend(state[k] for k in ['secretKey','jwtSecret','sessionEncryptionKey'])
    secrets.extend([state['push']['dataKey'],state['push']['privateKey'],status['SERVICE_ROLE_KEY']])
    secrets.extend(k['d'] for k in signing)
patterns=[s.encode() for s in secrets if isinstance(s,str) and len(s)>20]
files=[]
for name in ['src','server','scripts','infra','supabase/migrations','.github','tests','docs','public','dist','dist-review']:
    files.extend(f for f in (root/name).rglob('*') if f.is_file())
files.extend(f for f in root.iterdir() if f.is_file() and (f.suffix in ['.md','.json','.ts','.html','.yml','.mjs'] or f.name in ['.nvmrc','.npmrc','.gitignore']))
hits=[]
for f in files:
    data=f.read_bytes()
    if any(s in data for s in patterns): hits.append(str(f.relative_to(root)))
print(json.dumps({'files':len(files),'findings':hits},indent=2))
raise SystemExit(bool(hits))
