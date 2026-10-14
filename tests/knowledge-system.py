"""Offline regression tests for knowledge tooling, using disposable Git repositories."""
import importlib.util
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / 'scripts/knowledge.py'


class KnowledgeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='donas-knowledge-')
        self.root = pathlib.Path(self.tmp.name)
        (self.root/'scripts').mkdir()
        shutil.copyfile(SOURCE, self.root/'scripts/knowledge.py')
        self.dest = self.root/'docs/knowledge'
        (self.dest/'diagrams').mkdir(parents=True)
        (self.root/'api').mkdir()
        (self.root/'api/core.js').write_text('function handler() {}\n', encoding='utf-8')
        (self.root/'api/client.js').write_text("const core = require('./core');\n", encoding='utf-8')
        (self.dest/'AI_CONTEXT.md').write_text('# Context\n', encoding='utf-8')
        (self.dest/'PROJECT_MAP.md').write_text('# Map\n', encoding='utf-8')
        (self.dest/'DATABASE.md').write_text('# Database\n', encoding='utf-8')
        self.diagram = 'flowchart LR\n  A --> B\n'
        (self.dest/'diagrams/example.mmd').write_text(self.diagram, encoding='utf-8')
        (self.dest/'diagrams/example.md').write_text('```mermaid\n'+self.diagram+'```\n', encoding='utf-8')
        self.spec = {'areas': [{'id': 'all', 'globs': ['*'], 'documents': ['AI_CONTEXT.md']}],
                     'nodes': [{'id': 'feature:fixture', 'type': 'feature', 'label': 'Fixture',
                                'status': 'CONFIRMADO_CODIGO', 'refs': [{'path': 'api/core.js', 'line': 1, 'symbol': 'handler'}]}], 'edges': []}
        self.save_model()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Knowledge fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.run_tool('generate')
        self.run_tool('review', '--areas', 'all', '--note', 'fixture')
        self.run_tool('check', '--fresh')

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)

    def run_tool(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(self.root/'scripts/knowledge.py'), *args],
                                cwd=self.root, capture_output=True, encoding='utf-8')
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout+result.stderr)
        return result.stdout+result.stderr

    def save_model(self):
        (self.dest/'model.json').write_text(json.dumps(self.spec), encoding='utf-8')

    def report(self):
        return json.loads(self.run_tool('report'))

    def test_cache_and_cross_platform_text(self):
        before = (self.dest/'generated/graph.json').read_bytes()
        self.assertIn('0 analizados', self.run_tool('generate'))
        self.assertEqual(before, (self.dest/'generated/graph.json').read_bytes())
        (self.root/'api/core.js').write_bytes(b'function handler() {}\r\n')
        self.assertEqual(self.report()['changed_files'], [])
        self.assertIn('0 analizados', self.run_tool('generate'))
        self.run_tool('check', '--fresh')

    def test_modify_and_reverse_dependencies(self):
        (self.root/'api/core.js').write_text('function handler() { return true; }\n', encoding='utf-8')
        report = self.report()
        self.assertIn('api/core.js', report['changed_files'])
        self.assertIn('api/client.js', report['import_dependents'])
        self.run_tool('check', '--fresh', ok=False)
        self.assertIn('1 analizados', self.run_tool('generate'))
        self.run_tool('review', '--areas', 'all', '--note', 'changed')
        self.run_tool('check', '--fresh')

    def test_new_deleted_and_renamed_files(self):
        (self.root/'api/new.js').write_text('function added() {}\n', encoding='utf-8')
        self.assertIn('api/new.js', self.report()['changed_files'])
        self.run_tool('check', '--fresh', ok=False)
        self.git('mv', 'api/client.js', 'api/renamed.js')
        report = self.report()
        self.assertIn('api/client.js', report['changed_files'])
        self.assertIn('api/renamed.js', report['changed_files'])
        (self.root/'api/new.js').unlink()
        self.run_tool('generate')
        self.run_tool('review', '--areas', 'all', '--note', 'rename')
        self.run_tool('check', '--fresh')

    def test_doc_deletion_and_model_drift(self):
        (self.dest/'AI_CONTEXT.md').unlink()
        self.assertIn('docs/knowledge/AI_CONTEXT.md', self.report()['changed_documents'])
        self.run_tool('check', '--fresh', ok=False)
        self.spec['nodes'][0]['label'] = 'Updated'
        self.save_model()
        self.assertIn('Modelo semántico', self.run_tool('check', ok=False))

    def test_cached_import_does_not_create_dangling_edge_after_target_retirement(self):
        # Only the imported target changes; the importer stays cached byte-for-byte.
        (self.root/'api/core.js').unlink()
        self.spec['nodes'][0]['refs'] = [{'path': 'api/client.js', 'line': 1}]
        self.save_model()
        self.run_tool('generate')
        graph = json.loads((self.dest/'generated/graph.json').read_text(encoding='utf-8'))
        self.assertFalse(any(e['target'] == 'file:api/core.js' for e in graph['edges']))
        self.run_tool('check')

    def test_bad_reference_and_diagram_mismatch(self):
        self.spec['nodes'][0]['refs'][0]['symbol'] = 'missingSymbol'
        self.save_model()
        self.run_tool('generate')
        self.assertIn('Símbolo desplazado', self.run_tool('check', ok=False))
        (self.dest/'diagrams/example.mmd').write_text('flowchart LR\n A --> C\n', encoding='utf-8')
        self.assertIn('difieren', self.run_tool('check', ok=False))

    def test_binary_vendor_hashes_and_excluded_private_files(self):
        spec = importlib.util.spec_from_file_location('fixture_knowledge', self.root/'scripts/knowledge.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertNotEqual(module.canonical_bytes(pathlib.Path('assets/vendor/sdk.js'), b'a\r\n'), b'a\n')
        self.assertEqual(module.canonical_bytes(pathlib.Path('api/core.js'), b'a\r\n'), b'a\n')
        self.assertEqual(module.canonical_bytes(pathlib.Path('assets/image.svg'), b'<svg/>\r\n'), b'<svg/>\n')
        self.assertEqual(module.canonical_bytes(pathlib.Path('file.bin'), b'\x00a\r\n'), b'\x00a\r\n')
        for private in ['exports/users.json', 'local.properties', 'node_modules/sdk.js', 'android/app/build/output.json', 'keys.jks', 'google-services.json', 'scripts/__pycache__/knowledge.pyc']:
            self.assertFalse(module.eligible(private), private)
        (self.root/'exports').mkdir()
        (self.root/'exports/private.json').write_text('{"marker":"PRIVATE_FIXTURE"}', encoding='utf-8')
        self.run_tool('generate')
        self.assertNotIn('PRIVATE_FIXTURE', (self.dest/'generated/graph.json').read_text(encoding='utf-8'))

    def test_unmapped_area_prevents_review(self):
        self.spec['areas'][0]['globs'] = ['scripts/*', 'api/*']
        self.save_model()
        (self.root/'unmapped.txt').write_text('fixture', encoding='utf-8')
        self.run_tool('generate')
        self.assertIn('unmapped.txt', self.report()['unmapped_files'])
        self.assertIn('sin área', self.run_tool('review', '--areas', 'all', '--note', 'incomplete', ok=False))


if __name__ == '__main__':
    unittest.main()
