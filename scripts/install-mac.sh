#!/bin/bash
# Instalira Satnicu na macOS sa poslednjeg GitHub Release-a.
#   curl -fsSL https://raw.githubusercontent.com/pnkg99/satnica/main/scripts/install-mac.sh | bash
set -euo pipefail

REPO="pnkg99/satnica"
APP="Satnica.app"

case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) echo "Nepoznata arhitektura: $(uname -m)"; exit 1 ;;
esac

echo "→ Trazim poslednju verziju ($ARCH)..."
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o "\"browser_download_url\": *\"[^\"]*-$ARCH\.dmg\"" \
  | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')

if [ -z "$URL" ]; then
  echo "Nije nadjen dmg za $ARCH na https://github.com/$REPO/releases"
  exit 1
fi

TMP=$(mktemp -d)
MNT="$TMP/mnt"
trap 'hdiutil detach "$MNT" -quiet 2>/dev/null || true; rm -rf "$TMP"' EXIT

echo "→ Skidam $(basename "$URL")..."
curl -fL --progress-bar -o "$TMP/satnica.dmg" "$URL"

echo "→ Instaliram u /Applications..."
mkdir -p "$MNT"
hdiutil attach "$TMP/satnica.dmg" -nobrowse -quiet -mountpoint "$MNT"
osascript -e 'quit app "Satnica"' 2>/dev/null || true
rm -rf "/Applications/$APP"
cp -R "$MNT/$APP" /Applications/

# Aplikacija nije potpisana — bez ovoga macOS kaze da je "ostecena"
xattr -cr "/Applications/$APP"

echo "✓ Gotovo. Pokrecem Satnicu."
open "/Applications/$APP"
