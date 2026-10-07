# Vault

A password manager that never leaves your computer.

## First run

Open Kit → **Vault** and choose a master password (8 characters minimum; longer is better — a short sentence works well).

> **There is no reset.** The master password is never stored anywhere. If you forget it, the vault cannot be opened by anyone — including you.

## Everyday use

| Action | How |
| --- | --- |
| Add a login | **+**. The website is pre-filled from the tab you're on. |
| Strong password | **✦** in the password field generates 20 random characters (upper, lower, digits, symbols). |
| Fill a login form | Logins for the site you're on float to the top with a green **Fill** button. One click types the username and password into the page and closes Kit. |
| Copy | Hover a login: copy username / copy password. |
| Edit / delete | Click a login. Delete asks twice. |
| Search | The search box matches website and username. |

**Fill** only works when the page you're on matches the saved website (including its subdomains). If you're on a different site it refuses — that's deliberate, it protects you from look-alike phishing pages. If a site splits its login into two steps, click Fill again on the second step.

## Importing

The **↑** button opens an import page in a new tab (file pickers can't run inside a popup).

1. Export a CSV from your old password manager:
   - **Chrome / Edge:** `chrome://password-manager/settings` → *Export passwords*
   - **Firefox:** `about:logins` → ⋯ → *Export logins*
   - **Bitwarden, 1Password, LastPass:** their *Export → CSV* option
2. Drop the CSV onto the import page.
3. Kit shows how many logins it found, how many are **new**, and how many you **already have** (same site, username and password). Click **Import**.
4. **Delete the CSV.** It contains your passwords in plain text.

### CSV format

The first row is the header. Names are case-insensitive and columns can be in any order; extra columns are ignored.

| Field | Accepted column names |
| --- | --- |
| Website | `url`, `login_uri`, `website`, `web site`, `uri`, `origin`, `hostname`, `login url` |
| Name (used as the website when there's no http(s) URL) | `name`, `title` |
| Username (optional) | `username`, `login_username`, `user name`, `user`, `email`, `login`, `email address` |
| Password (required) | `password`, `login_password`, `pass` |

- URLs are reduced to the host without `www.` — `https://www.netflix.com/login` becomes `netflix.com`, which is what **Fill** matches against.
- Rows without a website or a password are skipped.
- Standard CSV quoting: wrap a field in `"…"` if it contains a comma, quote or line break, and double any quote inside (`"pa""ss"` → `pa"ss`).

Sample: **[sample-import.csv](../extension/src/pages/sample-import.csv)** (also linked from the import page under *Making your own CSV?*).

## Locking

The vault locks itself:

- after **15 minutes** without using it,
- when your computer's **screen locks**,
- when the **browser closes**.

The 🔒 button locks it immediately.

## How it's protected

| Piece | Detail |
| --- | --- |
| Key derivation | PBKDF2-HMAC-SHA256, **600,000** iterations, random 128-bit salt |
| Encryption | **AES-256-GCM**, fresh random 96-bit IV on every save; any tampering fails to decrypt |
| At rest | Only ciphertext, in the extension's `chrome.storage.local` |
| While unlocked | The derived key sits in `chrome.storage.session` — memory only, never written to disk |
| Fill | Injected only on your click, only into the current tab, only if the host matches |
| Network | None. The vault never syncs or uploads anything. |

Everything uses the browser's built-in Web Crypto — no third-party crypto code.

## Good to know

- Uninstalling Kit (or "Clear data" on the extension) deletes the vault. Keep a copy of anything critical somewhere else.
- Updating Kit keeps your vault: the extension ID is fixed by the key in `manifest.json`.
- The strength bar is a rough guide based on length and character variety, not a guarantee.
