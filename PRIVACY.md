# Privacy

_Last updated 7 October 2026_

**Kit collects nothing.** It has no servers, no accounts, no analytics, no ads and no telemetry. Nothing you do with Kit is sent to the author or anyone else.

## Boost

When you boost a tab, its audio is processed live inside your browser — either inside the page itself (default) or through Chrome's tab capture (only if you choose it). Audio is never recorded, stored or sent anywhere. Kit keeps a boosted tab's title in memory only, to show it in the tab strip.

## Vault

- Logins are encrypted with AES-256-GCM before being saved. Only ciphertext is written to disk, in the extension's local storage.
- The key is derived from your master password (PBKDF2-SHA256, 600,000 iterations). The master password is never stored.
- While unlocked, the key is held in Chrome's in-memory session storage and removed when the vault locks or the browser closes.
- **Fill** runs only when you click it, only in the current tab, and only if the page is on the saved website.
- Imported CSV files are read locally in your browser and never uploaded.
- Nothing is ever synced. Uninstalling Kit deletes the vault.

## Drop

Drop runs a small server (the Kit helper) on **your own computer**, reachable only on your local network. No internet service is involved.

- Devices join with a 6-character code shown in Kit.
- Device names are kept in memory only while Drop is on (each phone's browser remembers its own name).
- Messages and files live in memory and a temporary folder on your computer, and are deleted when you delete them, turn Drop off, or close Chrome.
- Traffic is plain HTTP inside your network. Anyone already on the same network who can watch its traffic could read it — use Drop on networks you trust.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the current tab's title and address when you open Kit; let Boost and Fill work on that tab |
| `scripting` | Run Boost's audio code and Vault's Fill inside the current tab, on your click |
| `tabCapture` | Optional tab-capture mode for protected players |
| `offscreen` | Keep tab-capture audio running after the popup closes |
| `storage` | Save the encrypted vault and remember your last tool |
| `alarms`, `idle` | Auto-lock the vault after inactivity or when your screen locks |
| `nativeMessaging` | Start and stop the Kit helper for Drop |

Kit has **no host permissions and no content scripts**: it cannot read pages in the background.

## Website

kit.1619.in is a static site. It sets no cookies and runs no analytics. The host (Netlify) keeps standard server logs.

## Contact

Open an issue at <https://github.com/KumarDeepak16/kit/issues>. For security problems, see [SECURITY.md](SECURITY.md).
