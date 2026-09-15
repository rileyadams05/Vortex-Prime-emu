# ModX GitHub catalogue backend migration

The public site and Cloudflare gateway use the version 2 catalogue contract. The persistence service at `modx.vortex-prime-emu.com` lives outside this repository and must apply the corresponding data migration before the new gateway is deployed.

## Canonical listing record

```json
{
  "id": "...",
  "gameExecutable": "WatchDogs.exe",
  "gameFingerprint": "sha256-hex",
  "gameId": "...",
  "author": { "id": "...", "name": "Riley" },
  "originalAuthor": { "id": "...", "name": "Riley" },
  "currentMaintainer": { "id": "...", "name": "Riley" },
  "source": {
    "provider": "github",
    "url": "https://github.com/user/repository",
    "repositoryUrl": "https://github.com/user/repository",
    "owner": "user",
    "repository": "repository",
    "branch": null,
    "tablePath": null
  },
  "originalSource": {},
  "sourceStatus": "available",
  "maintenanceMode": "author",
  "createdAt": "...",
  "updatedAt": "..."
}
```

`maintenanceMode` is `author` or `community`. `sourceStatus` is `available` or `unavailable`. A missing, private, renamed, or deleted GitHub source changes the status but does not delete the listing.

## Required persistence changes

1. Add structured current-source and original-source fields, maintenance mode, original-author/current-maintainer identifiers, and source-status fields as nullable columns.
2. Migrate existing GitHub-backed records into those fields. Preserve author, publication date, update date, executable name, fingerprint, and game association.
3. Mark legacy records without a safe GitHub source as `unavailable`; do not expose their locally hosted file URL.
4. Stop accepting multipart table or README uploads. The submit endpoint accepts JSON only and must reject file bodies.
5. Remove legacy file blobs only after backup/retention requirements have been decided. Then remove file name, file size, service-scope, service-list, future-service-support, platform, and README-upload columns when no other consumer uses them.
6. Add a maintenance-submission entity containing listing ID, contributor ID/name, proposed GitHub source, notes, status (`pending_review`, `approved`, `rejected`), reviewer, and timestamps. Approval updates only the current source/maintainer; it never changes original attribution.

## Gateway-facing endpoints

- `POST /community/submit` — create a version 2 JSON catalogue record.
- `GET /tables?executable=Game.exe&platform=windows` — return version 2 records.
- `GET /community/my-tables` — return version 2 records for the authenticated abuse key.
- `PATCH /community/tables/:id/source` — author/current-maintainer source replacement.
- `POST /community/tables/:id/maintenance-submissions` — create a pending reviewed proposal.

The persistence service should validate normalized GitHub data again. If it checks reachability, it should use GitHub API endpoints derived from validated owner/repository/path fields and must never fetch an arbitrary submitted URL.
