#!/bin/sh
# Registers the Kit helper with Chrome, Edge, Brave, Chromium and Firefox (macOS and Linux).
#   sh install.sh             install
#   sh install.sh --uninstall remove
set -e

HOST_NAME="in.1619.kit"
EXTENSION_ID="nbmfafaoglnmgabfcmkhcdhfbahgaffl"
FIREFOX_ID="kit@1619.in"
HERE="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$HERE/kit-host.sh"

if [ "$(uname)" = "Darwin" ]; then
  BASE="$HOME/Library/Application Support"
  FIREFOX_DIR="$BASE/Mozilla/NativeMessagingHosts"
else
  BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
  FIREFOX_DIR="$HOME/.mozilla/native-messaging-hosts"
fi

if [ "$1" = "--uninstall" ]; then
  for d in "$BASE/Google/Chrome" "$BASE/Microsoft Edge" "$BASE/BraveSoftware/Brave-Browser" "$BASE/Chromium" \
           "$BASE/google-chrome" "$BASE/microsoft-edge" "$BASE/chromium"; do
    rm -f "$d/NativeMessagingHosts/$HOST_NAME.json"
  done
  rm -f "$FIREFOX_DIR/$HOST_NAME.json" "$LAUNCHER"
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

# Firefox allows extensions by add-on id instead of origin, so it gets its own manifest.
if [ -d "$(dirname "$FIREFOX_DIR")" ]; then
  mkdir -p "$FIREFOX_DIR"
  cat > "$FIREFOX_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Kit helper: local Wi-Fi server for Drop",
  "path": "$LAUNCHER",
  "type": "stdio",
  "allowed_extensions": ["$FIREFOX_ID"]
}
EOF
fi

echo "Kit helper installed. Open Kit -> Drop -> Turn on."
