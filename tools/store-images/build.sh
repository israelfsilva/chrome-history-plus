#!/usr/bin/env bash
# Regenera as imagens da Chrome Web Store (store/images/<idioma>) a partir da extensão real.
#
# Requisitos: Node 22+, Python 3 e um Chrome for Testing (o Google Chrome estável não aceita
# mais --load-extension). Exemplo de instalação: npx @puppeteer/browsers install chrome@stable
#
# Uso: CHROME_BIN="/caminho/para/Google Chrome for Testing" tools/store-images/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
HERE="$ROOT/tools/store-images"
CHROME="${CHROME_BIN:?Defina CHROME_BIN com o caminho do executável do Chrome for Testing}"
WORK="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT

for LOCALE in en pt_BR; do
  EXT="$WORK/ext-$LOCALE"
  mkdir -p "$EXT"
  cp -R "$ROOT"/{manifest.json,background.js,sidebar.html,sidebar.css,sidebar.js,icons,_locales} "$EXT/"

  # Mantém só o idioma da vez e o define como padrão, para não depender do idioma do sistema
  find "$EXT/_locales" -mindepth 1 -maxdepth 1 ! -name "$LOCALE" -exec rm -rf {} +
  sed -i.bak "s/\"default_locale\": \"[^\"]*\"/\"default_locale\": \"$LOCALE\"/" "$EXT/manifest.json"

  # Kit de cenas: histórico fictício, favicons de letra e página de composição
  cp "$HERE"/kit/* "$EXT/"
  sed -i.bak 's#<script src="sidebar.js"></script>#<script src="shot-mock.js"></script><script src="sidebar.js"></script>#' "$EXT/sidebar.html"
  rm -f "$EXT"/*.bak

  node "$HERE/capture.mjs" "$CHROME" "$EXT" "$WORK/profile-$LOCALE" "$WORK/raw-$LOCALE" "${LOCALE/_/-}"
  python3 -I "$HERE/finalize.py" "$WORK/raw-$LOCALE" "$ROOT/store/images/$LOCALE"
done
