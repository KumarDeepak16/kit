# Contributing

Thanks for helping! Kit stays small on purpose: each tool does one job well, works offline, and sends nothing anywhere.

## Run it locally

1. Clone the repo.
2. `chrome://extensions` → **Developer mode** → **Load unpacked** → pick `extension/`.
3. For Drop: run `helper/install.cmd` (Windows) or `sh helper/install.sh`.
4. After editing, press ↻ on Kit's card. Edits to `helper/` take effect the next time Drop is turned on.

There's no build step and no dependencies to install — the extension is plain ES modules, the helper is plain Node.js.

## Guidelines

- **Local-first.** No network calls from the extension, no analytics, no remote code. The CSP enforces this.
- **Match the code around you.** Small modules, `h()` for DOM (never `innerHTML` with user data), existing CSS tokens and components.
- **Keep permissions minimal.** A new permission needs a clear reason in the PR and a line in `PRIVACY.md`.
- **Clean up after yourself.** Anything that runs in the background must stop when it's not needed, and report itself with `setBusy()` so the toolbar buddy is honest.
- **Accessible by default.** Labels on icon buttons, keyboard support, visible focus, `prefers-reduced-motion`.

## Adding a tool

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-one) — it's a folder and one line in a registry.

## Pull requests

- One change per PR, with a short description of what and why.
- Say how you tested it (which browser, which sites).
- Update the docs in `docs/` if behaviour changes, and add a line to `CHANGELOG.md`.

## Releasing (maintainers)

1. Bump `version` in `extension/manifest.json` and add a `CHANGELOG.md` entry.
2. Commit, then tag: `git tag v1.2.3 && git push origin v1.2.3`.
3. The **Release** workflow builds `kit.zip` and publishes the GitHub Release. The website's download button always serves the latest one.
