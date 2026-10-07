<p align="center">
  <img src="extension/icons/on/128.png" width="96" height="96" alt="Kit">
</p>

<h1 align="center">Kit</h1>

<p align="center">
  Three tiny, local-first tools for Chrome — <b>Boost</b>, <b>Vault</b> and <b>Drop</b>.<br>
  No account. No cloud. No tracking.
</p>

<p align="center">
  <a href="https://github.com/KumarDeepak16/kit/releases/latest/download/kit.zip"><b>Download kit.zip</b></a> ·
  <a href="https://kit.1619.in">Website</a> ·
  <a href="docs/">Docs</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

---

| Tool | What it does |
| --- | --- |
| **Boost** | Turn any tab up to **600%** (or down), with a limiter so it stays clean. Control several tabs from one dial. |
| **Vault** | Password manager that keeps everything **encrypted on your computer** (AES-256-GCM, PBKDF2 600k). One-click **Fill**, CSV **import** from Chrome / Bitwarden / 1Password / LastPass / Firefox. |
| **Drop** | Your computer becomes a tiny server on your **Wi-Fi**. Phones and laptops open it in the browser — no app — to swap **text, links, photos and files** both ways. |

Works in Chrome, Edge, Brave, Arc and other Chromium browsers, version 116 or newer.

## Install

1. Download **[kit.zip](https://github.com/KumarDeepak16/kit/releases/latest/download/kit.zip)** from the latest release and unzip it somewhere permanent.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the **`kit/extension`** folder.
4. Pin Kit from the puzzle-piece menu. The buddy is **purple and awake** while something is running, **grey and asleep** when idle.

**For Drop (one time):** open `kit/helper` and double-click **`install.cmd`** (Windows) or run `sh install.sh` (macOS / Linux). It needs [Node.js 18+](https://nodejs.org). Say yes to the firewall question so your phone can reach this computer.

**Updating:** download the new zip, replace the folder, then press ↻ on Kit's card in `chrome://extensions`. Your vault is kept — the extension ID is fixed.

## Using it

- **[Boost](docs/BOOST.md)** — open Kit on a tab and drag the dial, scroll, use arrow keys, or tap 100 · 200 · 300 · 600. Boosted tabs appear as chips at the top; tap one to control it from anywhere.
- **[Vault](docs/VAULT.md)** — set a master password once (it can't be recovered). Add logins, generate passwords, **Fill** on the site you're on, **import** a CSV.
- **[Drop](docs/DROP.md)** — Drop → **Turn on** → scan the QR with your phone. Name the device, then send anything. **⤢** opens a full-screen view.

Everything else — limits, troubleshooting, keyboard shortcuts — is in **[docs/](docs/)**.

## Privacy in one paragraph

Kit has no servers and sends nothing anywhere. The vault is encrypted before it touches disk and the key lives only in memory while unlocked. Boost processes audio live inside your browser. Drop runs only on your local network and deletes every received file when you turn it off. Full details: **[PRIVACY.md](PRIVACY.md)** · security reports: **[SECURITY.md](SECURITY.md)**.

## Repository

```
extension/   the Chrome extension (Manifest V3, plain ES modules, no build step)
helper/      Drop's local server: a Node.js native-messaging host + the web app devices open
docs/        user guides and architecture notes
.github/     release workflow — tagging vX.Y.Z publishes kit.zip
```

Want to add a tool or fix something? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## License

[MIT](LICENSE) © Deepak Kumar · [1619.in](https://1619.in) · GitHub [@KumarDeepak16](https://github.com/KumarDeepak16)
