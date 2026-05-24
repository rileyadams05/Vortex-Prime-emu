# PS4 Homebrew Store CDN

This directory exposes the assets required by the LightningMods PS4 Homebrew Store client.

## Contents
- `store.db` / `store_readonly.db`: SQLite catalogue with the `homebrews` table.
- `db_hash.json`: MD5 checksum of `store_readonly.db` used by the app to detect updates.
- `page1.json`: Legacy JSON page for pre-SQL store builds (optional but kept for compatibility).
- `main_app.json`: References to shared store UI assets.
- `storedata/`: Icons, background textures, and other cached media downloaded by the PS4 app.
- `pkgs/`: Host `.pkg` installers downloaded by the console (currently seeded with `{PACKAGE_FILENAME}`).
- `update/`: Signed loader updates (`homebrew.elf`, `homebrew.elf.sig`, `remote.md5`).

Update `store.db` (and copy to `store_readonly.db`) whenever you add or edit catalogue entries.
After modifying the database run a checksum update to refresh `db_hash.json`.
