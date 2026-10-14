"""Local, dependency-free architecture index and documentation drift detector.

Never imports application code, executes SQL, reads environment values or contacts a server.
Extraction is lexical: names and references are evidence of syntax, not runtime reachability.
"""
from __future__ import annotations
import argparse
import fnmatch
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs/knowledge'
GENERATED = DEST / 'generated'
TEXT = {'.py', '.js', '.cjs', '.mjs', '.kt', '.kts', '.swift', '.sql', '.gs', '.html', '.css', '.xml', '.md', '.json', '.yml', '.yaml', '.ps1', '.properties', '.rules', '.toml', '.example'}
EXCLUDE = ('docs/knowledge/', 'outputs/', 'exports/', 'test-output/', 'node_modules/', '.firebase/', '.git/', 'ruleta-donas-racha.html')
RELATIONS = {'DEPENDE_DE', 'LLAMA_A', 'LEE_DE', 'ESCRIBE_EN', 'SINCRONIZA_CON', 'NOTIFICA_A', 'IMPLEMENTA', 'CONTIENE', 'AFECTA_A'}
EXTRACTOR_VERSION = 4

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8', errors='replace')

def stamp():
    try:
        return datetime.now(ZoneInfo('America/Bogota')).isoformat(timespec='seconds')
    except ZoneInfoNotFoundError:
        from datetime import timezone, timedelta
        return datetime.now(timezone(timedelta(hours=-5))).isoformat(timespec='seconds')

def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def eligible(p):
    return not p.startswith(EXCLUDE) and not any(x in p.split('/') for x in ('build', '.gradle', 'dist', '.idea', '__pycache__')) and not p.endswith(('.log', '.apk', '.aab', '.jar', '.keystore', '.jks', '.pyc', '.pyo')) and pathlib.PurePosixPath(p).name not in ('local.properties', 'google-services.json', 'backend-results.json')

def paths():
    # Untracked additions in source areas also matter; ignored files are never read.
    return sorted({p for p in git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0') if p and eligible(p) and (ROOT / p).is_file()})

def canonical_bytes(path, raw=None):
    raw = path.read_bytes() if raw is None else raw
    # Git text checkout differs on Windows/Linux. Vendored -text assets stay literal.
    if '/vendor/' in path.as_posix() or b'\x00' in raw:
        return raw
    try:
        raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw
    return raw.replace(b'\r\n', b'\n')

def digest(path):
    return hashlib.sha256(canonical_bytes(path)).hexdigest()

def document_hashes():
    return {p.relative_to(ROOT).as_posix():digest(p) for p in DEST.rglob('*') if p.is_file() and 'generated' not in p.relative_to(DEST).parts}

def ref(path, line=1, symbol=None):
    result = {'path': path, 'line': line}
    if symbol:
        result['symbol'] = symbol
    return result

def extract(path):
    p = ROOT / path
    raw = p.read_bytes()
    result = {'path': path, 'sha256': hashlib.sha256(canonical_bytes(p, raw)).hexdigest(), 'bytes': len(canonical_bytes(p, raw)), 'symbols': [], 'imports': [], 'rpc_calls': [], 'tables': [], 'sql_objects': [], 'sql_changes': [], 'endpoints': [], 'animations': []}
    if p.suffix not in TEXT or '/vendor/' in path or path == 'package-lock.json' or '/schemas/' in path:
        return result
    source = raw.decode('utf-8', errors='replace')
    result['lines'] = len(source.splitlines())
    patterns = [
        ('function', r'^\s*(?:export\s+)?(?:async\s+)?function\s+([\w$]+)'),
        ('class', r'^\s*(?:(?:public|private|internal|final|open|data|sealed|enum|@MainActor)\s+)*(?:class|object|interface|actor|struct|enum)\s+(\w+)'),
        ('function', r'^\s*(?:(?:public|private|internal|override|suspend|static|final|@discardableResult)\s+)*(?:fun|func)\s+(\w+)'),
        ('sql_function', r'(?i)^\s*create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)'),
        ('function', r'^\s*(?:async\s+)?def\s+(\w+)'),
    ]
    for n, line in enumerate(source.splitlines(), 1):
        for kind, pattern in patterns:
            if m := re.search(pattern, line):
                result['symbols'].append({'name': m[1], 'kind': kind, 'line': n})
        for m in re.finditer(r'''require\(['"](\.[^'"]+)['"]\)''', line):
            target = (p.parent / m[1]).resolve()
            if not target.suffix:
                target = target.with_suffix('.js')
            try:
                target_path = target.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            if target.is_file():
                result['imports'].append({'target': target_path, 'line': n})
        for m in re.finditer(r'''(?:\brpc|\buserRpc)\(['"](\w+)['"]''', line):
            result['rpc_calls'].append({'name': m[1], 'line': n})
        if m := re.search(r'@keyframes\s+([\w-]+)', line):
            result['animations'].append({'name': m[1], 'line': n})
        if m := re.search(r'(?i)^\s*create\s+(?:or\s+replace\s+)?(table|view|policy|trigger|index)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)', line):
            result['sql_objects'].append({'kind': m[1].lower(), 'name': m[2], 'line': n})
        for m in re.finditer(r'''['"](/api/[A-Za-z0-9_?=/.-]+)['"]''', line):
            result['endpoints'].append({'value': m[1], 'line': n})
    # Initial column inventory. ALTERs remain separate evidence, not simulated deployed DDL.
    if p.suffix == '.sql':
        for m in re.finditer(r'(?im)^[ \t]*create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(', source):
            start = m.end(); pos = start; depth = 1; quote = False
            while pos < len(source) and depth:
                c = source[pos]
                if c == "'":
                    if quote and pos + 1 < len(source) and source[pos + 1] == "'":
                        pos += 2; continue
                    quote = not quote
                elif not quote:
                    depth += (1 if c == '(' else -1 if c == ')' else 0)
                pos += 1
            body = source[start:pos-1]
            columns = []; segment = 0; level = 0; quoted = False
            for offset, char in enumerate(body + ','):
                if char == "'": quoted = not quoted
                elif not quoted:
                    level += (1 if char == '(' else -1 if char == ')' else 0)
                    if char == ',' and level == 0:
                        part = body[segment:offset]
                        if cm := re.search(r'^\s*(\w+)\s+([\w.]+(?:\[\])?)', part):
                            if cm[1].lower() not in ('constraint', 'primary', 'foreign', 'unique', 'check'):
                                columns.append({'name': cm[1], 'type': cm[2], 'line': source.count('\n', 0, start + segment + cm.start(1)) + 1})
                        segment = offset + 1
            result['tables'].append({'name': m[1], 'line': source.count('\n', 0, m.start())+1, 'columns': columns})
        for m in re.finditer(r'(?im)^[ \t]*(alter\s+(?:table|function|type|publication)|drop\s+(?:function|trigger|policy)|grant\s+\w+|revoke\s+\w+)\s+([^;]+);',source):
            # Store only action + object identifier + evidence, never SQL bodies/values.
            target=re.search(r'(?:public\.)?([A-Za-z_][\w]*)',m[2])
            result['sql_changes'].append({'kind':m[1].lower(),'target':target[1] if target else '?','line':source.count('\n',0,m.start())+1})
    return result

def model():
    return read_json(DEST / 'model.json')

def affected(changed, spec):
    areas = [a for a in spec['areas'] if any(fnmatch.fnmatchcase(p, g) for p in changed for g in a['globs'])]
    return areas, sorted({d for a in areas for d in a['documents']})

def generate():
    spec = model()
    old = read_json(GENERATED / 'inventory.json', {'files': []})
    cache = {f['path']: f for f in old['files']} if old.get('extractor_version') == EXTRACTOR_VERSION else {}
    inventory = []; reparsed = 0
    for path in paths():
        if path in cache and cache[path]['sha256'] == digest(ROOT / path):
            inventory.append(cache[path])
        else:
            inventory.append(extract(path)); reparsed += 1
    meta = {'source_commit': git('rev-parse', 'HEAD').strip(), 'scope': 'working tree; lexical extraction, production unverified', 'schema_version': 1, 'extractor_version': EXTRACTOR_VERSION, 'hash_algorithm': 'sha256; text CRLF normalized to LF; vendor/binary literal', 'model_sha256': digest(DEST/'model.json')}
    write_json(GENERATED / 'inventory.json', {**meta, 'files': inventory})
    nodes = {n['id']: n for n in spec['nodes']}
    edges = list(spec['edges'])
    indexed_paths = {item['path'] for item in inventory}
    for item in inventory:
        fid = 'file:' + item['path']
        nodes[fid] = {'id': fid, 'type': 'archivo', 'label': item['path'], 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'])]}
        for s in item['symbols']:
            sid = fid + ':' + s['kind'] + ':' + s['name'] + ':' + str(s['line'])
            nodes[sid] = {'id': sid, 'type': s['kind'], 'label': s['name'], 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'], s['line'], s['name'])]}
            edges.append({'source': fid, 'target': sid, 'type': 'CONTIENE', 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'], s['line'], s['name'])]})
        for imp in item['imports']:
            # Cached importers may still reference a target deleted since the last extraction.
            if imp['target'] not in indexed_paths:
                continue
            edges.append({'source': fid, 'target': 'file:' + imp['target'], 'type': 'DEPENDE_DE', 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'], imp['line'])]})
        for rpc in item['rpc_calls']:
            rid = 'rpc:' + rpc['name']
            nodes.setdefault(rid, {'id': rid, 'type': 'rpc', 'label': rpc['name'], 'status': 'CONFIRMADO_CODIGO', 'refs': []})
            nodes[rid]['refs'].append(ref(item['path'], rpc['line'], rpc['name']))
            edges.append({'source': fid, 'target': rid, 'type': 'LLAMA_A', 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'], rpc['line'], rpc['name'])]})
        if item['path'].startswith('supabase/migrations/'):
            for s in item['symbols']:
                if s['kind'] == 'sql_function':
                    rid = 'rpc:' + s['name']
                    nodes.setdefault(rid, {'id': rid, 'type': 'rpc', 'label': s['name'], 'status': 'CONFIRMADO_CODIGO', 'refs': []})
                    nodes[rid]['refs'].append(ref(item['path'], s['line'], s['name']))
            for t in item['tables']:
                tid = 'table:' + t['name']
                nodes.setdefault(tid, {'id': tid, 'type': 'tabla_supabase', 'label': t['name'], 'status': 'CONFIRMADO_CODIGO', 'refs': [ref(item['path'], t['line'], t['name'])]})
            for obj in item['sql_objects']:
                # Policies/triggers/indexes can reuse names on different tables/migrations.
                oid = ('table:' if obj['kind']=='table' else 'view:') + obj['name'] if obj['kind'] in ('table','view') else f"{obj['kind']}:{item['path']}:{obj['name']}:{obj['line']}"
                evidence=ref(item['path'],obj['line'],obj['name'])
                nodes.setdefault(oid, {'id':oid,'type':'sql_'+obj['kind'],'label':obj['name'],'status':'CONFIRMADO_CODIGO','refs':[evidence]})
                edges.append({'source':fid,'target':oid,'type':'CONTIENE','status':'CONFIRMADO_CODIGO','refs':[evidence]})
    write_json(GENERATED / 'graph.json', {**meta, 'limitations': ['No AST ni call graph exhaustivo', 'No resuelve funciones renombradas ni overloads SQL', 'No certifica despliegue ni ejecución; relaciones semánticas en model.json'], 'nodes': sorted(nodes.values(), key=lambda n: n['id']), 'edges': edges})
    def link(path, line=1):
        return f'[{path}:L{line}](../../../{path}#L{line})'
    lines = ['# Inventario verificable', '', 'Generado por `python scripts/knowledge.py generate`. Nombres extraídos, sin contenido de credenciales ni datos.', '', f'Commit fuente: `{meta["source_commit"]}`; {len(inventory)} archivos. El inventario incluye metadatos de recursos binarios, esquemas Room y SDK vendorizado; no interpreta su código generado.', '', '[Volver al mapa](../PROJECT_MAP.md)', '']
    for item in inventory:
        lines += [f'## {item["path"]}', '', f'{link(item["path"])} · {item.get("lines", "binario/generado")} líneas · SHA-256 `{item["sha256"][:12]}`', '']
        for s in item['symbols']:
            lines.append(f'- `{s["kind"]} {s["name"]}` — {link(item["path"], s["line"])}')
        if item['symbols']: lines.append('')
    GENERATED.mkdir(parents=True, exist_ok=True)
    (GENERATED / 'CODE_INDEX.md').write_text('\n'.join(lines).rstrip()+'\n', encoding='utf-8')
    lines = ['# Catálogo SQL local', '', 'Declaraciones en migraciones ordenadas por nombre. **No es un esquema materializado ni una inspección de producción.** ALTER/rename/drop pueden cambiar estos objetos; consultar el historial completo y DATABASE.md.', '', '[Modelo explicado](../DATABASE.md)', '']
    for item in inventory:
        if not item['path'].startswith('supabase/migrations/'): continue
        lines += [f'## {pathlib.Path(item["path"]).name}', '', link(item['path']), '']
        for t in item['tables']:
            lines += [f'### Tabla `{t["name"]}`', '', '| Columna inicial | Tipo inicial | Evidencia |', '|---|---|---|']
            for c in t['columns']: lines.append(f'| `{c["name"]}` | `{c["type"]}` | {link(item["path"], c["line"])} |')
            lines.append('')
        for obj in item['sql_objects']:
            if obj['kind'] != 'table': lines.append(f'- {obj["kind"]} `{obj["name"]}` — {link(item["path"], obj["line"])}')
        for s in item['symbols']:
            if s['kind'] == 'sql_function': lines.append(f'- función `{s["name"]}` — {link(item["path"], s["line"])}')
        for change in item.get('sql_changes',[]):
            lines.append(f'- cambio/permisos `{change["kind"]}` (`{change["target"]}`; abrir SQL para objeto completo) — {link(item["path"],change['line'])}')
        lines.append('')
    (GENERATED / 'SQL_CATALOG.md').write_text('\n'.join(lines).rstrip()+'\n', encoding='utf-8')
    print(f'Índices regenerados: {len(inventory)} archivos; {reparsed} analizados; {len(nodes)} nodos; {len(edges)} relaciones. La revisión humana no se certifica automáticamente.')

def changes(base=None):
    old = read_json(GENERATED / 'review-state.json', {'sources': {}})['sources']
    current = {p: digest(ROOT/p) for p in paths()}
    changed = {p for p in set(old) | set(current) if old.get(p) != current.get(p)}
    if base:
        # Validate ref first and use an explicit end revision: no shell evaluation.
        commit = git('rev-parse', '--verify', base + '^{commit}').strip()
        changed.update(p for p in git('diff', '--name-only', '-z', commit, 'HEAD').split('\0') if p and eligible(p))
    # Include staged/unstaged renames, deletions and additions even when no baseline exists.
    changed.update(p for p in git('diff', '--name-only', '-z', 'HEAD').split('\0') if p and eligible(p) and old.get(p) != current.get(p))
    return sorted(changed), current

def report(base=None, output=None):
    spec = model(); changed, _ = changes(base)
    old_docs = read_json(GENERATED/'review-state.json', {'documents': {}})['documents']
    current_docs = document_hashes()
    changed_docs = sorted(p for p in set(old_docs)|set(current_docs) if old_docs.get(p)!=current_docs.get(p))
    graph = read_json(GENERATED/'graph.json', {'edges': []})
    impacted = set(changed)
    while True:
        previous = len(impacted)
        for e in graph['edges']:
            if e['type'] == 'DEPENDE_DE' and e['target'].startswith('file:') and e['source'].startswith('file:') and e['target'][5:] in impacted:
                impacted.add(e['source'][5:])
        if len(impacted) == previous: break
    areas, documents = affected(impacted, spec)
    covered = {p for p in impacted if any(fnmatch.fnmatchcase(p, g) for a in spec['areas'] for g in a['globs'])}
    result = {'date': stamp(), 'commit': git('rev-parse','HEAD').strip(), 'changed_files': changed, 'changed_documents': changed_docs, 'import_dependents': sorted(impacted-set(changed)), 'areas': [a['id'] for a in areas], 'documents_to_review': documents, 'unmapped_files': sorted(impacted-covered), 'status': 'POSIBLEMENTE_DESACTUALIZADO' if changed or changed_docs else 'SIN_DERIVA_DE_FUENTES', 'instructions': 'Revisar código/diffs, model.json y diagramas afectados; generate actualiza índices, review registra revisión humana. No deduce despliegue.'}
    if output: write_json(pathlib.Path(output), result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return bool(changed or changed_docs)

def check(fresh=False):
    errors = []; spec = model(); graph = read_json(GENERATED/'graph.json', {'nodes': [], 'edges': []})
    if graph.get('model_sha256') != digest(DEST/'model.json'): errors.append('Modelo semántico sin regenerar: model.json')
    ids = [n['id'] for n in graph['nodes']]
    if len(ids) != len(set(ids)): errors.append('Identificadores duplicados')
    for item in graph['nodes'] + graph['edges']:
        if 'source' in item and (item['source'] not in ids or item['target'] not in ids or item['type'] not in RELATIONS): errors.append('Relación inválida: '+str(item))
        if item.get('status') not in ('CONFIRMADO_CODIGO', 'INFERIDO', 'PENDIENTE_VERIFICACION'): errors.append('Estado inválido: '+str(item))
        for r in item.get('refs', []):
            p=ROOT/r['path']
            if not p.is_file(): errors.append('Referencia inexistente: '+str(r)); continue
            if p.suffix not in TEXT: continue
            lines=p.read_text(encoding='utf-8',errors='replace').splitlines()
            n=r.get('line',1)
            if not 1<=n<=len(lines): errors.append('Línea inexistente: '+str(r))
            elif r.get('symbol') and r['symbol'] not in lines[n-1]: errors.append('Símbolo desplazado: '+str(r))
    for p in DEST.rglob('*.md'):
        s=p.read_text(encoding='utf-8')
        if s.count('```')%2: errors.append('Bloque sin cerrar: '+str(p.relative_to(ROOT)))
        for m in re.finditer(r'!?\[[^\]]*\]\(([^\s)]+)\)',s):
            target=m[1].split('#')[0]
            if target and not re.match(r'\w+://',target) and not (p.parent/target).resolve().is_file(): errors.append('Enlace roto: '+str(p.relative_to(ROOT))+' -> '+target)
            elif target and not re.match(r'\w+://',target) and (line_ref:=re.search(r'#L(\d+)$',m[1])):
                linked=(p.parent/target).resolve()
                if not 1<=int(line_ref[1])<=len(linked.read_text(encoding='utf-8',errors='replace').splitlines()): errors.append('Línea de enlace inexistente: '+str(p.relative_to(ROOT))+' -> '+m[1])
    for p in (DEST/'diagrams').glob('*.mmd'):
        if not p.read_text(encoding='utf-8').startswith(('flowchart','sequenceDiagram','stateDiagram','erDiagram')): errors.append('Tipo Mermaid desconocido: '+p.name)
        companion=p.with_suffix('.md')
        body=re.search(r'```mermaid\s*\n(.*?)\n```', companion.read_text(encoding='utf-8'), re.S) if companion.is_file() else None
        if not body or body[1].strip()!=p.read_text(encoding='utf-8').strip(): errors.append('Diagrama y vista Markdown difieren: '+p.name)
    if fresh:
        state=read_json(GENERATED/'review-state.json', {'sources': {},'documents': {}})
        for p in paths():
            if state['sources'].get(p)!=digest(ROOT/p): errors.append('Fuente sin revisión: '+p)
        for p in state['sources']:
            if not (ROOT/p).is_file(): errors.append('Fuente eliminada sin revisión: '+p)
        inv=read_json(GENERATED/'inventory.json', {'files': []})
        if {i['path'] for i in inv['files']}!=set(paths()): errors.append('Archivos nuevos/eliminados sin regenerar inventario')
        for item in inv['files']:
            if not (ROOT/item['path']).is_file() or digest(ROOT/item['path'])!=item['sha256']: errors.append('Índice desactualizado: '+item['path'])
        current_docs=document_hashes()
        for p in set(current_docs)|set(state['documents']):
            if current_docs.get(p)!=state['documents'].get(p): errors.append('Documento modificado/eliminado sin revisión registrada: '+p)
    if errors:
        print('\n'.join(sorted(set(errors)))); raise SystemExit(1)
    print(f'PASS: {len(ids)} nodos, {len(graph["edges"])} relaciones, enlaces y referencias válidos. '+('Sin deriva respecto de revisión.' if fresh else 'Sin certificar vigencia semántica o producción.'))

def review(areas, note, date=None):
    # Explicit human/agent review declaration; never called by generate or CI.
    spec=model(); valid={a['id'] for a in spec['areas']}
    chosen=set(areas.split(','))
    if not chosen<=valid: raise SystemExit('Áreas desconocidas: '+','.join(chosen-valid))
    changed,current=changes()
    unmapped=[p for p in changed if not any(fnmatch.fnmatchcase(p,g) for a in spec['areas'] for g in a['globs'])]
    if unmapped: raise SystemExit('Agregar reglas para archivos sin área: '+','.join(unmapped))
    needed,_=affected(changed,spec)
    if not {a['id'] for a in needed}<=chosen: raise SystemExit('Faltan áreas afectadas; ejecutar report y revisar todas antes de registrar.')
    inventory=read_json(GENERATED/'inventory.json', {'files': []})
    indexed={i['path']:i['sha256'] for i in inventory['files']}
    if indexed!=current: raise SystemExit('Ejecutar generate antes de review: índices desactualizados.')
    documents=document_hashes()
    when=date or stamp()
    write_json(GENERATED/'review-state.json', {'date':when,'commit':git('rev-parse','HEAD').strip(),'scope':'working tree, hashes de texto normalizados LF; binarios/vendor literales; sin verificación de producción','areas':sorted(chosen),'note':note,'sources':current,'documents':documents})
    history=read_json(GENERATED/'review-history.json', [])
    history.append({'date':when,'commit':git('rev-parse','HEAD').strip(),'areas':sorted(chosen),'changed_files':changed,'note':note})
    write_json(GENERATED/'review-history.json',history)
    print('Revisión registrada; CHANGELOG.md debe describir los hallazgos y pruebas.')

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('generate')
    p=sub.add_parser('report');p.add_argument('--base');p.add_argument('--output')
    p=sub.add_parser('check');p.add_argument('--fresh',action='store_true')
    p=sub.add_parser('review');p.add_argument('--areas',required=True);p.add_argument('--note',required=True);p.add_argument('--date')
    p=sub.add_parser('query');p.add_argument('term')
    args=parser.parse_args()
    if args.command=='generate': generate()
    elif args.command=='report': report(args.base,args.output)
    elif args.command=='check': check(args.fresh)
    elif args.command=='review': review(args.areas,args.note,args.date)
    else:
        g=read_json(GENERATED/'graph.json'); term=args.term.casefold()
        found=[n for n in g['nodes'] if term in n['label'].casefold() or term in n['id'].casefold()]
        ids={n['id'] for n in found}
        print(json.dumps({'nodes':found,'edges':[e for e in g['edges'] if e['source'] in ids or e['target'] in ids]},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
