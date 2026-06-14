# Vortex Prime Store

Vortex Prime Store is a community package store and creator portal for publishing console apps, homebrew packages, PC tools, and mods. It is focused on browsing, managing, and publishing community uploads through a web store experience.

> This project is in active development. Features, layouts, upload rules, and publishing workflows may change as the store is improved.

## What This Project Does

Vortex Prime Store provides:

- A public Store page for approved packages and tools
- A public Store Mods page for mod archive uploads
- A Creator Portal for adding, editing, and exporting store content
- Google sign-in UI for creator/admin identity
- Profile controls for signed-in users
- Package detail pages with preview media, YouTube videos, README content, and useful links
- GitHub Pages support for hosting the public site
- Optional backend support for live uploads and server-side validation

## Store Sections

The public site is split into two main areas:

| Section | Purpose |
| --- | --- |
| Store | Homebrew apps, console apps, PC tools, and platform-specific packages |
| Store Mods | Compressed mod archives and mod-related uploads |

The Store and Store Mods pages share the same visual style, but their upload rules are different.

## Creator Portal

The Creator Portal is used to prepare packages before they are published.

Creators/admins can add:

- Package title
- Creator or author name
- Platform
- Tags
- Icon image
- Preview image
- Package or archive file
- README or Markdown description file
- YouTube video links
- External download or source URL

The portal supports both Store uploads and Store Mods uploads.

## Upload Rules

### Store

Store uploads support different file types depending on platform and category.

General package behavior:

- Homebrew Apps and Console Apps use `.pkg` where required
- PC Tools use compressed archives
- PlayStation 2 uses compressed archives
- Xbox 360 uses compressed archives with internal validation
- Original Xbox uses compressed archives with internal validation

Archive formats:

- `.zip`
- `.7z`
- `.rar`

### Store Mods

Mods are uploaded as compressed archives only.

Allowed mod archive formats:

- `.zip`
- `.7z`
- `.rar`

Mods do not use the Store category selector.

## Platform Archive Validation

Some platforms require extra validation before publishing.

### Xbox 360

Xbox 360 archives must contain at least one of:

- `.xex` executable
- Extensionless LIVE/CON container file

Allowed supporting files include:

- `.ini`
- `.txt`

### Original Xbox

Original Xbox archives must contain at least one:

- `.xbe` executable

Allowed supporting files include:

- `.ini`
- `.txt`
- Standard media asset folders

## Media And Details

Each public package can include a detail view with a media-style layout.

Supported detail content:

- Existing preview image
- Embedded YouTube videos
- README text
- Markdown README content
- Approved external guide or source links

The README area is designed to feel similar to the way GitHub displays a repository README: it appears as a readable section on the package details page after the main media area.

## README Uploads

Creators can upload a README file for a Store item or Mod item.

Supported README formats:

- `.txt`
- `.md`
- `.markdown`

The README is saved with the item metadata so it can display on GitHub Pages without needing a live backend.

## YouTube Videos

The Creator Portal supports YouTube links as links, not video file uploads.

Supported examples:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- YouTube Shorts links

YouTube links are converted into embedded video players on the public package detail view.

## Editing Published Items

Published Store and Store Mods items include an Edit button. The button opens the Creator Portal for the selected item so the owner/admin can update the same fields used when the package was first created.

## Project Structure

```text
.github/workflows/
  pages.yml               GitHub Pages deployment for VortexPrimeStore/docs
  desktop-release.yml     Manual Tauri desktop app build workflow

VortexPrimeStore/
  docs/
  index.html              Public website, Store, Store Mods, and shared UI
  admin/index.html        Store Creator Portal
  store/themes.json       Static Store catalogue
  store-mods/mods.json    Static Mods catalogue

  backend/
  server.py               FastAPI routes and upload validation
  store_service.py        Submission saving, metadata, archive handling

  assets/
  Store/submissions/      Uploaded package assets when using the backend
```

## Local Development

The public website can be viewed from the `docs` folder as a static site. Backend upload features require the Python API.

Install backend dependencies:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu\VortexPrimeStore"
pip install -r backend\requirements.txt
```

Run the backend:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu\VortexPrimeStore"
python backend\server.py
```

When the site is opened on `localhost`, it can use the local backend API for dynamic store data and uploads.

## Publishing To GitHub Pages

After editing the site or exported JSON files, publish with:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu"
git status
git add -A
git commit -m "Update Vortex Prime Store"
git push origin main
```

GitHub Pages will rebuild from the repository after the push.

## Community

Join the Discord server for support, testing, feedback, and project discussion:

https://discord.gg/PVFJ64QA

## Status

Vortex Prime Store is still being actively built. Current work is focused on:

- Improving package detail pages
- Expanding creator tools
- Making publishing easier
- Improving validation for platform-specific uploads
- Keeping the active project folder clean and focused

## Policies

See the privacy and terms documents in `VortexPrimeStore/`.
