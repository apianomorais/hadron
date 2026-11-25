"""Gera index.html (o jogo pronto) juntando src/ui.html, src/engine.js e o símbolo do LFCA/URCA."""
import base64
import pathlib

root = pathlib.Path(__file__).parent
html = (root / 'src' / 'ui.html').read_text(encoding='utf-8')
engine = (root / 'src' / 'engine.js').read_text(encoding='utf-8')
logo = base64.b64encode((root / 'assets' / 'lfca-urca-256.png').read_bytes()).decode()
assert html.count('/*ENGINE*/') == 1, 'marcador /*ENGINE*/ ausente em src/ui.html'
assert '{{LOGO}}' in html, 'marcador {{LOGO}} ausente em src/ui.html'
out = html.replace('/*ENGINE*/', engine).replace('{{LOGO}}', 'data:image/png;base64,' + logo)
(root / 'index.html').write_text(out, encoding='utf-8')
print('index.html gerado')
