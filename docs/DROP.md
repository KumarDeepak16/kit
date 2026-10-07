# Drop

Turn your computer into a tiny server on your Wi-Fi. Any phone, tablet or laptop on the same network can open it in a browser and swap **text, links, photos and files** with you — no app, no account, no internet.

## One-time setup

Chrome doesn't allow extensions to open network ports, so Drop uses a small helper program that the extension starts and stops for you.

1. Install **[Node.js 18 or newer](https://nodejs.org)** (the LTS version is fine).
2. In the Kit folder, open **`helper`** and:
   - **Windows:** double-click **`install.cmd`**
   - **macOS / Linux:** run `sh install.sh`
3. **Windows:** answer **Y** to the firewall question (one UAC click) so other devices on your *private* network can reach this computer. If you skip it, Windows asks the first time a phone connects — choose *Allow* on private networks.

That's it. The installer only registers the helper with your browsers (Chrome, Edge, Brave, Chromium) for your user account — no admin rights, nothing runs in the background.

- Moved the Kit folder? Run the installer again.
- Remove it: **`uninstall.cmd`** / `sh install.sh --uninstall`.

## Using it

1. Kit → **Drop** → **Turn on**. You'll see a QR code, this computer's address (like `192.168.1.7:7777`) and a 6-character code.
2. On the other device, **scan the QR** with the camera — or type the address into any browser and enter the code.
3. Name the device once (it's remembered), and you're in.

On every device you can now:

- **send text and links** — links are clickable, long messages fold with *Show more*,
- **send photos and files** — 🖼 for photos/videos, 📎 for any file, or paste / drag them in,
- **copy** any message, **save** any file, **delete** anything (it disappears everywhere),
- **tap a photo** to view it full-size.

**Full screen on your computer:** the **⤢** button opens Drop in a tab with the QR, address, code and connected devices in a sidebar — handy for big transfers and the file picker.

**Turning it off** (⏻ in Kit, or closing Chrome) stops the server, disconnects everyone and **deletes every received file**. Devices see *Drop is off*.

## Phones and the clipboard

Drop runs on plain HTTP inside your network, and browsers only let web pages *read* the clipboard on HTTPS. So on phones:

- **Paste** with the system menu: long-press the message box → *Paste*. Pasting an image sends it as a photo.
- **Copy an image:** tap it to open the viewer, then long-press it → *Copy image*.
- Copying text with the **Copy** button works everywhere.

On the computer (popup and full-screen view) the Copy-image button works directly.

## Security

- Devices can only join with the current 6-character code (it's inside the QR). After 8 wrong guesses, joining is locked for a minute.
- Each time you turn Drop on you get a new code; old devices must re-join.
- Pages can only change things through Drop's own page — requests from other websites are rejected.
- Traffic stays inside your network but **is not encrypted there**, like most local tools. Use Drop on networks you trust (your home Wi-Fi), not on public hotspots.
- Received files live in a temporary folder that's deleted when Drop stops.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Kit shows **One-time setup** after installing | Reload Kit in `chrome://extensions`. Make sure `node --version` works in a terminal, then run the installer again. |
| The phone can't open the address | Both devices must be on the same Wi-Fi — guest networks and some office networks isolate devices. Allow Node.js through the firewall on private networks. Turn off VPNs. |
| Several network adapters (VPN, virtual machines) | Tap **Wrong network? Try …** under the code to cycle through this computer's addresses. |
| Phone says **Drop is off** | Drop was turned off or Chrome closed. Turn it on and scan the new QR. |
| A file upload stopped | Phones pause browsers in the background. Keep the page open until it finishes. |

## Under the hood

- [`extension/src/tools/drop/drop.bg.js`](../extension/src/tools/drop/drop.bg.js) starts the helper with `chrome.runtime.connectNative('in.1619.kit')`. The open port keeps the service worker alive; disconnecting it makes the helper exit.
- [`helper/kit-host.mjs`](../helper/kit-host.mjs) is a dependency-free Node.js HTTP server: join codes, device names, live updates (Server-Sent Events), uploads streamed to disk, downloads with proper filenames.
- [`helper/public/`](../helper/public/) is the web app every device sees.
