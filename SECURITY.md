# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's private reporting instead:
**[Report a vulnerability](https://github.com/KumarDeepak16/kit/security/advisories/new)**.

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a reply within a few days, and credit in the release notes if you'd like it.

## Supported versions

Only the latest release gets fixes.

## What Kit protects, and how

| Area | Design |
| --- | --- |
| Vault at rest | AES-256-GCM, key from PBKDF2-HMAC-SHA256 (600k iterations, random salt). Ciphertext only on disk. |
| Vault in use | Key in `chrome.storage.session` (memory). Auto-locks after 15 min idle, on screen lock and on browser exit. |
| Fill | Only on click, only in the active tab, refuses unless the page host matches the saved site. |
| Extension pages | CSP `script-src 'self'; object-src 'none'; connect-src http://127.0.0.1:*`. No remote code, no internet access. |
| Page access | No content scripts, no host permissions — `activeTab` only. |
| Drop helper | LAN-only HTTP server. Join code required (lockout after 8 wrong tries), cross-site writes rejected, constant-time token checks, static files confined to `helper/public/`, temp files deleted on stop. |

## Known limits

- **Drop is unencrypted on the local network.** Someone already on the same network who can sniff traffic could read transfers. Use trusted networks.
- **A compromised computer is out of scope.** Malware running as your user can read memory, keystrokes or the unlocked vault key.
- **Weak master passwords can be brute-forced** offline by anyone who copies your browser profile. Use a long one.
