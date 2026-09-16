# ModX GitHub Release catalogue migration

The website gateway and Cloudflare catalogue use the version 3 contract. A listing is anchored to a specific, published GitHub Release, while its repository identity allows the desktop app to check the same canonical project for later releases.

## Canonical listing record

```json
{
  "id": "...",
  "gameId": "...",
  "gameExecutable": "WatchDogs.exe",
  "gameFingerprint": "sha256-hex",
  "author": { "name": "Riley" },
  "originalAuthor": { "name": "Riley" },
  "github": {
    "repositoryUrl": "https://github.com/user/repository",
    "releaseUrl": "https://github.com/user/repository/releases/tag/v1.3.0",
    "owner": "user",
    "repository": "repository",
    "tag": "v1.3.0"
  },
  "version": "v1.3.0",
  "release": {
    "tag": "v1.3.0",
    "releaseId": "...",
    "commitSha": "...",
    "publishedAt": "...",
    "checkedAt": "...",
    "asset": {
      "id": "...",
      "name": "WatchDogs.ct",
      "downloadUrl": "https://github.com/user/repository/releases/download/v1.3.0/WatchDogs.ct",
      "digest": "..."
    }
  },
  "sourceStatus": "available",
  "maintenanceMode": "author",
  "createdAt": "...",
  "updatedAt": "..."
}
```

`maintenanceMode` is `author` or `community`. Community maintenance means the repository owner grants trusted GitHub collaborators or teams permission to publish releases from the same canonical repository. ModX does not operate a proposal, fork, source-replacement, or approve/reject maintainer workflow.

## Persistence migration

Apply `cloudflare/migrations/0009_github_release_versions.sql` after migration 0008. It adds the release URL, tag/version, GitHub release ID, target commit, release timestamps, and selected `.CT` asset metadata. Existing records are preserved and marked `unavailable` until they can be associated with a verified public GitHub Release.

Do not delete or recreate production D1. Do not discard historical rows. The old maintenance-submission table may remain physically present for retention/audit safety, but no active Worker or website route reads or writes it.

## Validation and publication contract

1. The browser fingerprints the selected game executable locally and sends metadata only.
2. The source must match `https://github.com/OWNER/REPOSITORY/releases/tag/TAG`. Repository-only URLs, blob URLs, HTTP, query strings, fragments, deceptive hosts, and non-GitHub hosts are rejected by both the browser and Workers.
3. The persistence Worker derives an `api.github.com` request from the validated owner, repository, and tag. It verifies the public repository and published Release, reads the tag as the version, resolves the target commit, and locates `.CT` release assets.
4. A single `.CT` asset is selected automatically. Multiple `.CT` assets require an explicit asset ID; no asset is chosen arbitrarily.
5. Neither the executable nor the `.CT` asset is uploaded to or mirrored by ModX.

## Gateway-facing endpoints

- `POST /community/resolve-release` — verify a public GitHub Release and return its version and `.CT` assets.
- `POST /community/submit` — create a version 3 JSON catalogue record after re-verifying the Release.
- `GET /tables?executable=Game.exe&platform=windows` — return version 3 machine-readable records for the desktop app.
- `GET /tables/:id/releases/latest` — check the same canonical repository's latest published Release and refresh stored release metadata.

Legacy direct upload/download endpoints remain `410 Gone`. The public website contains no community catalogue browser or listing-management UI.
