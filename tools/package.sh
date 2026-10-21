#!/usr/bin/env bash
# Gera o pacote para envio à Chrome Web Store: dist/history-plus-<versão>.zip
# Inclui somente os arquivos usados pela extensão em tempo de execução.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT"

FILES=(manifest.json background.js sidebar.html sidebar.css sidebar.js icons _locales)

# Validações: manifest bem formado, arquivos referenciados presentes e traduções consistentes
VERSION="$(python3 -I - <<'PY'
import json, os, sys
m = json.load(open('manifest.json'))
paths = [m['background']['service_worker'], m['side_panel']['default_path'], *m['icons'].values(), *m['action']['default_icon'].values()]
missing = [p for p in paths if not os.path.exists(p)]
if missing:
    sys.exit(f'Arquivos referenciados no manifest não encontrados: {missing}')
locales = {d: json.load(open(f'_locales/{d}/messages.json')) for d in os.listdir('_locales') if not d.startswith('.')}
if m['default_locale'] not in locales:
    sys.exit(f"default_locale '{m['default_locale']}' sem pasta em _locales/")
keys = {d: set(v) for d, v in locales.items()}
base = keys[m['default_locale']]
for d, k in keys.items():
    if k != base:
        sys.exit(f'_locales/{d} difere de {m["default_locale"]}: faltando {base - k}, sobrando {k - base}')
for d, v in locales.items():
    if len(v['extDescription']['message']) > 132:
        sys.exit(f'_locales/{d}: extDescription passa de 132 caracteres')
print(m['version'])
PY
)"

OUT="dist/history-plus-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -q -X -r "$OUT" "${FILES[@]}" -x '*.DS_Store'

echo "Pacote gerado: $OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
