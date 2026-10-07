#!/bin/sh
# Registers the Kit helper with Chrome, Edge, Brave and Chromium (macOS and Linux).
#   sh install.sh             install
#   sh install.sh --uninstall remove
set -e

HOST_NAME="in.1619.kit"
EXTENSION_ID="nbmfafaoglnmgabfcmkhcdhfbahgaffl"
HERE="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$HERE/kit-host.sh"

if [ "$(uname)" = "Darwin" ]; then
  BASE="$HOME/Library/Application Support"
else
  BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
fi

if [ "$1" = "--uninstall" ]; then
  for d in "$BASE/Google/Chrome" "$BASE/Microsoft Edge" "$BASE/BraveSoftware/Brave-Browser" "$BASE/Chromium" \
           "$BASE/google-chrome" "$BASE/microsoft-edge" "$BASE/chromium"; do
    rm -f "$d/NativeMessagingHosts/$HOST_NAME.json"
  done
  rm -f "$LAUNCHER"
  echo "Kit helper removed."
  exit 0
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Kit helper needs Node.js 18 or newer: https://nodejs.org" >&2
  exit 1
fi

printf '#!/bin/sh\nexec "%s" "%s/kit-host.mjs" "$@"\n' "$NODE" "$HERE" > "$LAUNCHER"
chmod +x "$LAUNCHER"

MANIFEST=$(cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "Kit helper: local Wi-Fi server for Drop",
  "path": "$LAUNCHER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF
)

for d in "$BASE/Google/Chrome" "$BASE/Microsoft Edge" "$BASE/BraveSoftware/Brave-Browser" "$BASE/Chromium" \
         "$BASE/google-chrome" "$BASE/microsoft-edge" "$BASE/chromium"; do
  [ -d "$d" ] || continue
  mkdir -p "$d/NativeMessagingHosts"
  printf '%s\n' "$MANIFEST" > "$d/NativeMessagingHosts/$HOST_NAME.json"
done

echo "Kit helper installed. Open Kit -> Drop -> Turn on."
