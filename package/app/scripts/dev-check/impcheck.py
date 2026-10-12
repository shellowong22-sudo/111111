import os,re,sys
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..')).replace('\\','/')
alias={'@/':root+'/client/src/','@shared/':root+'/shared/'}
def resolve(base,spec):
    p=None
    for a,t in alias.items():
        if spec.startswith(a): p=t+spec[len(a):]
    if spec.startswith('.'): p=os.path.normpath(os.path.join(os.path.dirname(base),spec))
    if not p: return None
    for ext in ['','.ts','.tsx','/index.ts','/index.tsx','.js']:
        if os.path.isfile(p+ext): return p+ext
    return 'MISSING:'+p
cache={}
def exports(f):
    if f in cache: return cache[f]
    s=open(f).read(); names=set()
    for m in re.finditer(r'export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)',s): names.add(m.group(1))
    if re.search(r'export\s+default',s): names.add('default')
    for m in re.finditer(r'export\s+(?:type\s+)?\{([^}]*)\}(\s*from\s*["\']([^"\']+)["\'])?',s,re.S):
        for part in m.group(1).split(','):
            part=part.strip()
            if not part: continue
            part=re.sub(r'^type\s+','',part)
            nm=part.split(' as ')[-1].strip()
            names.add(nm)
    for m in re.finditer(r'export\s+\*\s+from\s+["\']([^"\']+)["\']',s):
        r=resolve(f,m.group(1))
        if r and not r.startswith('MISSING'): names|=exports(r)
    cache[f]=names; return names
bad=0
for f in sys.argv[1:]:
    s=open(f).read()
    for m in re.finditer(r'import\s+(type\s+)?([^;]*?)\s+from\s+["\']([^"\']+)["\']',s,re.S):
        spec=m.group(3)
        if not (spec.startswith('.') or spec.startswith('@/') or spec.startswith('@shared/')): continue
        r=resolve(f,spec)
        if r is None: continue
        if r.startswith('MISSING'): print(f,'MISSING MODULE',spec); bad+=1; continue
        clause=m.group(2)
        ex=exports(r)
        mb=re.search(r'\{([^}]*)\}',clause,re.S)
        if mb:
            for part in mb.group(1).split(','):
                part=part.strip()
                if not part or part.startswith('type '): continue
                nm=part.split(' as ')[0].strip()
                if nm not in ex: print(f,'NO EXPORT',nm,'in',spec); bad+=1
        d=re.sub(r'\{[^}]*\}','',clause).strip().strip(',').strip()
        if d and not d.startswith('*') and not m.group(1) and 'default' not in ex: print(f,'NO DEFAULT in',spec); bad+=1
    # dynamic import
    for m in re.finditer(r'import\(\s*["\']([^"\']+)["\']\s*\)',s):
        spec=m.group(1); r=resolve(f,spec)
        if r and r.startswith('MISSING'): print(f,'MISSING DYN',spec); bad+=1
print('bad',bad)
