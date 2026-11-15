# Changelog

## 1.0.2 — 2026-11-15

**Firefox**
- Kit runs in Firefox. Boost uses its in-page engine there; Vault and Drop work unchanged.

**Drop**
- Setup shows the steps for your computer (Windows, macOS, Linux) and says when a device can't run Drop.
- When the helper is missing, won't start or isn't allowed, Kit says which and shows the browser's reason.
- The helper writes a log: `%LOCALAPPDATA%\Kit\kit-host.log`, `~/Library/Logs/Kit/kit-host.log` or `~/.local/state/kit/kit-host.log`.
- `install.sh` always registers Chrome, lists the browsers it set up, refuses `sudo`, checks for Node.js 18+, works with nvm/fnm/volta, tests the helper and warns when macOS would block the Kit folder.

**Upgrading:** run the helper installer again to get the log.

## 1.0.1 — 2026-10-07

**Drop**
- Open pages update themselves when the helper is updated — no more stale phone UI after an upgrade.
- Helper web app files always revalidate instead of being cached for an hour.

**Vault**
- Import page explains the CSV columns and offers a downloadable sample file.

**Docs**
- CSV format in `docs/VAULT.md`, screenshots and requirements in the README.

## 1.0.0 — 2026-10-07

First release.

**Boost**
- Per-tab volume from 0% to 600% with a built-in limiter.
- Dial with drag, scroll and keyboard control; 100 · 200 · 300 · 600 presets.
- In-page engine by default — no "sharing this tab" indicator.
- Opt-in tab capture for DRM / protected players.
- Tab strip to control every boosted tab from one popup.

**Vault**
- AES-256-GCM vault keyed by PBKDF2-SHA256 (600k iterations).
- Add, edit, delete, search, copy; strong password generator.
- One-click Fill on the matching site.
- CSV import from Chrome, Edge, Firefox, Bitwarden, 1Password, LastPass.
- Auto-lock after 15 minutes, on screen lock and on browser exit.

**Drop**
- Local Wi-Fi server via the Kit helper (Node.js native-messaging host).
- QR + 6-character code to join; device names.
- Text, links, photos and files both ways; copy, save, delete everywhere.
- Image viewer with copy; paste images to send; long messages fold.
- Full-screen host view with invite sidebar.
- Everything deleted when Drop is turned off.

**Kit**
- Toolbar buddy shows when anything is running.
- Header tool switcher, light Duolingo-style design, reduced-motion support.
