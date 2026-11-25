"""Gera index.html (o jogo pronto) juntando src/ui.html e src/engine.js."""
import pathlib

root = pathlib.Path(__file__).parent
html = (root / 'src' / 'ui.html').read_text(encoding='utf-8')
engine = (root / 'src' / 'engine.js').read_text(encoding='utf-8')
assert html.count('/*ENGINE*/') == 1, 'marcador /*ENGINE*/ ausente em src/ui.html'
(root / 'index.html').write_text(html.replace('/*ENGINE*/', engine), encoding='utf-8')
print('index.html gerado')
