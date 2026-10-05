# Releasing Rune

Rune ships auto-updates via `tauri-plugin-updater`. On every launch the app
quietly checks the endpoint in `src-tauri/tauri.conf.json`
(`plugins.updater.endpoints`) for a signed `latest.json` manifest.

## One-time setup

Signing keys were generated with:

```bash
npx @tauri-apps/cli signer generate --write-keys ~/.tauri/rune-updater.key
```

- **Private key**: `~/.tauri/rune-updater.key` — never commit, never share.
- **Public key**: embedded in `tauri.conf.json` under `plugins.updater.pubkey`.

The endpoint in `tauri.conf.json` currently points at:

```
https://github.com/bhansa/rune/releases/latest/download/latest.json
```

Adjust that URL when you rename the repo or move hosting.

## Cutting a release

1. Bump the version in three places:
   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version =`
   - `src-tauri/tauri.conf.json` → `"version"`

2. Build a signed bundle:

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/rune-updater.key"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
   npm run tauri build
   ```

   This produces (in `src-tauri/target/release/bundle/`):
   - `dmg/Rune_<version>_aarch64.dmg` — the installer
   - `macos/Rune.app.tar.gz` — the updater artifact
   - `macos/Rune.app.tar.gz.sig` — the signature over the artifact

3. Write `latest.json` (or generate it — Tauri emits one when
   `bundle.createUpdaterArtifacts` is true, but you still need to fill in
   the download URL):

   ```json
   {
     "version": "0.2.0",
     "notes": "What changed",
     "pub_date": "2026-08-11T18:00:00Z",
     "platforms": {
       "darwin-aarch64": {
         "signature": "<contents of Rune.app.tar.gz.sig>",
         "url": "https://github.com/bhansa/rune/releases/download/v0.2.0/Rune.app.tar.gz"
       }
     }
   }
   ```

4. Create a GitHub Release tagged `v<version>` and attach:
   - `Rune_<version>_aarch64.dmg`
   - `Rune.app.tar.gz`
   - `latest.json`

   Users on `< version>` will be prompted on next launch. They can also
   force-check via the Settings sheet.

## Notes

- Bundles are unsigned for macOS Gatekeeper (no Apple Developer ID).
  First-run users need to right-click → Open. Notarization requires an
  `$99/yr` Apple Developer account; add via
  [Tauri code-signing docs](https://tauri.app/v2/distribute/sign/macos/).
- For an Intel build, cross-compile with `--target x86_64-apple-darwin`
  and add a `darwin-x86_64` block to `latest.json`.
- If the private key is lost, updater is bricked for existing installs —
  rotate the pubkey in `tauri.conf.json` and users will need to re-install
  manually.
