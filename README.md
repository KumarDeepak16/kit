<p align="center">
  <img src="extension/icons/on/128.png" width="96" height="96" alt="Kit">
</p>

<h1 align="center">Kit</h1>

<p align="center">
  Small, local-first tools for Chrome — <b>Boost</b>, <b>Vault</b>, <b>Drop</b>, and more to come.<br>
  No account. No cloud. No tracking.
</p>

<p align="center">
  <a href="https://github.com/KumarDeepak16/kit/releases/latest"><img src="https://img.shields.io/github/v/release/KumarDeepak16/kit?label=release&color=9b5cff" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-58cc02" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Chrome-116%2B-1cb0f6" alt="Chrome 116+">
  <img src="https://img.shields.io/badge/Manifest-V3-ff9600" alt="Manifest V3">
</p>

<p align="center">
  <a href="https://github.com/KumarDeepak16/kit/releases/latest/download/kit.zip"><b>⬇ Download kit.zip</b></a> ·
  <a href="https://kit.1619.in"><b>🌐 kit.1619.in</b></a> ·
  <a href="docs/">Docs</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <img src="docs/images/boost-hot.webp" width="260" alt="Boost: a dial turning a tab up to 495%">
  &nbsp;
  <img src="docs/images/vault.webp" width="260" alt="Vault: saved logins with a one-click Fill button">
  &nbsp;
  <img src="docs/images/drop-chat.webp" width="260" alt="Drop: messages and photos shared with a phone">
</p>

---

## What's inside

| Tool | What it does |
| --- | --- |
| **🔊 Boost** | Turn any tab up to **600%** (or down), kept clean by a limiter. Control several tabs from one dial. No "sharing this tab" icon. |
| **🛡 Vault** | Passwords **encrypted on your computer** (AES-256-GCM, PBKDF2 600k). One-click **Fill** on the site you're on. **Import** a CSV from Chrome, Edge, Firefox, Bitwarden, 1Password or LastPass. |
| **⇅ Drop** | Your computer becomes a tiny server on your **Wi-Fi**. Phones and laptops open it in a browser — no app — to swap **text, links, photos and files** both ways. |

## Requirements

| | Needed for | Details |
| --- | --- | --- |
| **Chromium browser 116+** | Everything | Chrome, Edge, Brave, Arc, Vivaldi, Opera… on Windows, macOS or Linux |
| **or Firefox 128+** | Everything | Boost can't use tab capture there, so DRM players (Netflix, Spotify…) can't be boosted |
| **Developer mode** | Installing | Kit isn't on the Chrome Web Store yet, so it's loaded unpacked |
| **[Node.js 18+](https://nodejs.org)** | Drop only | Runs the small local server. Boost and Vault don't need it. |
| **Same Wi-Fi** | Drop only | Your phone and computer on one network (guest networks often isolate devices) |
| **Any modern mobile browser** | Drop on phones | Chrome, Safari, Firefox, Samsung Internet — nothing to install |

## Install

1. Download **[kit.zip](https://github.com/KumarDeepak16/kit/releases/latest/download/kit.zip)** and unzip it somewhere permanent (Chrome loads it from that folder).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the **`kit/extension`** folder.
4. Pin Kit from the puzzle-piece menu. The buddy is **purple and awake** while something is running, **grey and asleep** when idle.

**Firefox:** open **[kit-firefox.xpi](https://github.com/KumarDeepak16/kit/releases/latest/download/kit-firefox.xpi)** in Firefox and click **Add**. For Drop, also download kit.zip for the helper below.

**For Drop (one time):** open `kit/helper` and double-click **`install.cmd`** (Windows) or run `sh install.sh` (macOS / Linux). Say yes to the firewall question so your phone can reach this computer.

**Updating:** download the new zip, replace the folder, press ↻ on Kit's card in `chrome://extensions`, and turn Drop off and on if it was running. Your vault is kept — the extension ID is fixed.

## Using it

### 🔊 Boost
Open Kit on a tab and drag the dial, scroll, use the arrow keys, or tap **100 · 200 · 300 · 600**. Every boosted tab shows up as a chip at the top — tap one to control it without switching tabs. Protected (DRM) players get an opt-in tab-capture mode. → [docs/BOOST.md](docs/BOOST.md)

<p align="center"><img src="docs/images/boost-tabs.webp" width="260" alt="Boost controlling two tabs from the tab strip"></p>

### 🛡 Vault
Set a master password once (**it can't be recovered**). Add logins, generate strong passwords, click **Fill** on the site you're on, or **import** a CSV — there's a [sample file](extension/src/pages/sample-import.csv) and the [column format](docs/VAULT.md#csv-format). Locks itself after 15 minutes, on screen lock and when Chrome closes. → [docs/VAULT.md](docs/VAULT.md)

### ⇅ Drop
**Drop → Turn on**, scan the QR with your phone, name the device, send anything. Tap a photo to view or copy it. **⤢** opens the full-screen view on your computer. Turning Drop off deletes everything that was shared. → [docs/DROP.md](docs/DROP.md)

<p align="center">
  <img src="docs/images/drop-full.webp" width="600" alt="Drop full-screen view with QR code, join code and connected devices">
  &nbsp;
  <img src="docs/images/phone.webp" width="180" alt="Drop on a phone">
</p>

Keyboard shortcuts, limits and troubleshooting are in **[docs/](docs/)**.

## Privacy

Kit has no servers and sends nothing anywhere. The vault is encrypted before it touches disk, and the key lives only in memory while unlocked. Boost processes audio live inside your browser. Drop runs only on your local network and deletes every shared file when you turn it off. Full details: **[PRIVACY.md](PRIVACY.md)** · security reports: **[SECURITY.md](SECURITY.md)**.

## Repository

```
extension/   the Chrome extension (Manifest V3, plain ES modules, no build step)
helper/      Drop's local server: a Node.js native-messaging host + the web app devices open
docs/        user guides, architecture notes and screenshots
.github/     release workflow — tagging vX.Y.Z publishes kit.zip
```

Want to add a tool or fix something? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Changes are listed in **[CHANGELOG.md](CHANGELOG.md)**.

## License

[MIT](LICENSE) © Deepak Kumar · [1619.in](https://1619.in) · Website [kit.1619.in](https://kit.1619.in) · GitHub [@KumarDeepak16](https://github.com/KumarDeepak16)
