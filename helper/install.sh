#!/bin/sh
# Registers the Kit helper with Chrome, Edge, Brave, Chromium and Firefox (macOS and Linux).
# No admin rights needed. Run again any time (e.g. after moving the Kit folder).
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
  CHROME_DIR="$BASE/Google/Chrome"
  FIREFOX_DIR="$BASE/Mozilla/NativeMessagingHosts"
  LOG_DIR="$HOME/Library/Logs/Kit"
else
  BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
  CHROME_DIR="$BASE/google-chrome"
  FIREFOX_DIR="$HOME/.mozilla/native-messaging-hosts"
  LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/kit"
fi
BROWSER_DIRS="$BASE/Google/Chrome|$BASE/Microsoft Edge|$BASE/BraveSoftware/Brave-Browser|$BASE/Chromium|$BASE/google-chrome|$BASE/microsoft-edge|$BASE/chromium"

if [ "$1" = "--uninstall" ]; then
  echo "$BROWSER_DIRS" | tr '|' '\n' | while IFS= read -r d; do
    rm -f "$d/NativeMessagingHosts/$HOST_NAME.json"
  done
  rm -f "$FIREFOX_DIR/$HOST_NAME.json" "$LAUNCHER" "$LOG_DIR/kit-host.log"
  rmdir "$LOG_DIR" 2>/dev/null || true
  echo "Kit helper removed."
  exit 0
fi

# Browsers read helpers from *your* home folder; under sudo they'd land in root's.
if [ "$(id -u)" = "0" ]; then
  echo "Run this without sudo:  sh install.sh" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Kit helper needs Node.js 18 or newer: https://nodejs.org" >&2
  exit 1
fi
# The real binary, not a version-manager shim (nvm, fnm, volta, asdf) that only works inside a terminal.
NODE="$(node -p 'process.execPath')"
MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 18 ]; then
  echo "Node.js $MAJOR found; Kit helper needs 18 or newer: https://nodejs.org" >&2
  exit 1
fi

# The helper's errors go to a log (overwritten each run) so there's something to read when Drop fails.
mkdir -p "$LOG_DIR"
printf '#!/bin/sh\nexec "%s" "%s/kit-host.mjs" "$@" 2>"%s/kit-host.log"\n' "$NODE" "$HERE" "$LOG_DIR" > "$LAUNCHER"
chmod +x "$LAUNCHER"

# Smoke test: with no input the helper must start and exit cleanly.
if ! "$LAUNCHER" </dev/null >/dev/null; then
  echo "The helper failed to start with $NODE:" >&2
  cat "$LOG_DIR/kit-host.log" >&2
  exit 1
fi

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

# Chrome always gets the helper (even before its first launch); other browsers only if installed.
mkdir -p "$CHROME_DIR"
REGISTERED=$(echo "$BROWSER_DIRS" | tr '|' '\n' | while IFS= read -r d; do
  [ -d "$d" ] || continue
  mkdir -p "$d/NativeMessagingHosts"
  printf '%s\n' "$MANIFEST" > "$d/NativeMessagingHosts/$HOST_NAME.json"
  echo "  $d"
done)

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
  REGISTERED="$REGISTERED
  $(dirname "$FIREFOX_DIR")"
fi

echo "Kit helper installed for:"
echo "$REGISTERED"

# macOS blocks apps started by the browser from reading these folders without permission.
case "$HERE" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*|"$HOME/Library/Mobile Documents"*)
    echo ""
    echo "Note: the Kit folder is in Desktop, Documents, Downloads or iCloud. If Drop says"
    echo "the helper stopped, move the Kit folder to your home folder and run this again."
    ;;
esac

echo ""
echo "Open Kit -> Drop -> Turn on."
