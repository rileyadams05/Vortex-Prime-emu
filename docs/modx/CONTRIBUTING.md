# Contribute a ModX table listing

Vortex Prime does not collect Google sign-ins or accept table uploads through its website. ModX catalogue changes are proposed as GitHub pull requests.

## Submit a listing

1. Sign in to GitHub, fork `rileyadams05/Vortex-Prime-emu`, and edit `docs/modx/catalogue.json`.
2. Add metadata for the table using the fields shown below.
3. Link to the creator's own public GitHub repository or Release. The Vortex Prime repository stores only reviewed listing metadata.
4. Open a pull request against `main`. Include supported game/version details, offline or single-player scope, source attribution, and any permissions needed to redistribute or link the material.
5. Wait for review and merge before treating the listing as published.

Do not upload compiled trainers, cheat tables, game executables, or third-party files to this website repository. Keep files in their creator-owned repository or release, and only link to material that its owner permits others to use.

## Entry fields

- `id`: unique lowercase slug.
- `name`: table or project name.
- `game`: game and supported version.
- `creator`: original creator or current maintainer.
- `summary`: short description and known compatibility notes.
- `releaseUrl`: HTTPS GitHub project or Release URL.

GitHub account authentication happens on GitHub when opening a pull request. Vortex Prime does not ask visitors to create an account or sign in.
