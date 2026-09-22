#!/bin/sh
# Renders og-card.html to ../public/og.png at 1200 x 630 through headless Chrome.
# Needs network: the card loads Inter and Source Serif 4 from Google Fonts at render time.
set -eu
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot="../public/og.png" "file://$PWD/og-card.html" 2>/dev/null
python3 - <<'PY'
from PIL import Image
im = Image.open("../public/og.png")
assert im.size == (1200, 630), im.size
print("og.png", im.size)
PY
