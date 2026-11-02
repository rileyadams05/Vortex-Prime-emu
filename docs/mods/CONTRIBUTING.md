# Add a community mod

Vortex Prime does not have a website upload portal or website sign-in. Community catalogue changes are reviewed as GitHub pull requests.

## Submit an entry

1. Sign in to GitHub, fork this repository, and edit `docs/mods/mods.json`.
2. Add one object to the `mods` array using the fields shown below.
3. Open a pull request against `main` and include the game's version, supported platform, and where the release is maintained.
4. Wait for review before describing the entry as part of the Vortex Prime catalogue.

The website repository stores catalogue text only. Link to the creator's public release; do not commit package files, binaries, or files you do not have permission to redistribute.

## Entry fields

- `id`: unique lowercase slug.
- `name`: displayed mod name.
- `creator`: creator or maintainer name.
- `platform`: one of PS4, PS3, PS2, PS Vita, PSP, Original Xbox, or Xbox 360.
- `description`: short plain-text summary.
- `releaseUrl`: HTTPS link to the creator's public release or project page on GitHub.

Example:

```json
{
  "mods": [
    {
      "id": "example-mod",
      "name": "Example Mod",
      "creator": "Creator Name",
      "platform": "PS3",
      "description": "A short description and compatibility note.",
      "releaseUrl": "https://github.com/creator/example-mod/releases"
    }
  ]
}
```
