# Vortex Prime Store API

This Cloudflare Worker serves the production `/api` backend for the Vortex Prime Store using Cloudflare Workers + Google Drive storage.

## Why Uploads 404 Right Now

GitHub Pages can host the website files, but it cannot receive package uploads or save files.

If `https://vortex-prime-emu.com/api/status` returns anything other than JSON, the Worker configuration or Google Drive credentials are not deployed yet.

The Creator Portal becomes a proper live store only after this Worker is deployed.

## What You Need

- A Cloudflare account with `vortex-prime-emu.com` added as a website.
- Cloudflare Workers enabled.
- A Google Cloud Project with a service account that has access to the Drive folders you want to use.
- A Cloudflare API token for deployment.
- The GitHub repository secrets listed below.

You do not need users to download anything. This is only for deploying the website backend.

Required Cloudflare resources:

- Worker route: `vortex-prime-emu.com/api/*`
- Google Drive folders (IDs captured as secrets) for packages, mods, icons, previews, readmes, and the catalogue JSON file.

Required GitHub Actions secrets:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

After those secrets exist, pushing to `main` deploys the Worker automatically.

## GitHub Secrets

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Open `Actions`.
5. Add these repository secrets:

```text
CF_ACCOUNT_ID
CF_API_TOKEN
```

`CF_ACCOUNT_ID` is your Cloudflare Account ID.

`CF_API_TOKEN` must allow Workers Scripts deploy and Workers Routes edit (R2 access is no longer required).

In Cloudflare, add these **Worker secrets** (Dashboard → Workers → your Worker → Settings → Variables → Add binding → Secret text):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
DRIVE_DATABASE_FILE_ID
DRIVE_PACKAGES_FOLDER_ID
DRIVE_MODS_FOLDER_ID
DRIVE_ICONS_FOLDER_ID
DRIVE_PREVIEWS_FOLDER_ID
DRIVE_READMES_FOLDER_ID
GOOGLE_OAUTH_CLIENT_ID
FIREBASE_PROJECT_ID
FIREBASE_API_KEY
FIREBASE_APP_ID
FIREBASE_AUTH_DOMAIN
GOOGLE_ADMIN_EMAILS
SESSION_SECRET
STREAMZ_OAUTH_STATE_SECRET
STREAMZ_TWITCH_CLIENT_ID
STREAMZ_KICK_CLIENT_ID
STREAMZ_KICK_CLIENT_SECRET
STREAMZ_YOUTUBE_CLIENT_ID
STREAMZ_YOUTUBE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
DISCORD_APPLICATION_ID
DISCORD_PUBLIC_KEY
DISCORD_BOT_TOKEN
DISCORD_GUILD_ID
STREAMZ_EXPIRED_CODE_REVIEW_STAFF
STREAMZ_OWNER_GOOGLE_SUB
```

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — The email for the service account that has Drive access.
- `GOOGLE_PRIVATE_KEY` — The PEM private key for that service account (copy it from the JSON key file; do **not** commit the JSON to git).
- `DRIVE_DATABASE_FILE_ID` — The file ID of `store-db.json` in Drive (copy from the file's URL).
- `DRIVE_*_FOLDER_ID` — Folder IDs for each upload bucket (create folders once in Drive, copy the ID from the URL, and make sure the service account has at least writer access).
- `GOOGLE_OAUTH_CLIENT_ID` — The OAuth 2.0 Web client ID used by Google Identity Services.
- `FIREBASE_PROJECT_ID` — The existing Firebase project's project ID. Firebase ID tokens are rejected unless their audience and issuer match it.
- `FIREBASE_API_KEY` / `FIREBASE_APP_ID` — Web app configuration copied from the existing Firebase project.
- `FIREBASE_AUTH_DOMAIN` — The existing Firebase Authentication domain (normally `<project-id>.firebaseapp.com`).
- `GOOGLE_ADMIN_EMAILS` — Comma-separated list of Google accounts (or domains prefixed with `@`) that should have admin rights for catalogue management.
- `SESSION_SECRET` — Random string used to sign auth cookies (at least 32 characters).
- `STREAMZ_OAUTH_STATE_SECRET` — Random string used to encrypt and validate Streamz OAuth state payloads (at least 32 characters).
- `STREAMZ_TWITCH_CLIENT_ID` — Twitch public client ID for Streamz. Twitch uses PKCE and does not require a client secret for this website callback flow.
- `STREAMZ_KICK_CLIENT_ID` / `STREAMZ_KICK_CLIENT_SECRET` — Kick app credentials for Streamz. Never commit the secret.
- `STREAMZ_YOUTUBE_CLIENT_ID` / `STREAMZ_YOUTUBE_CLIENT_SECRET` — Google OAuth client credentials used only by the Worker for YouTube channel authorization. Never commit the secret.
- `STRIPE_SECRET_KEY` — Stripe test or live secret key used only by the Worker to create Streamz Pro PaymentIntents.
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret for `/api/streamz/pro/webhook`.
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key returned by the Streamz Pro config endpoint for frontend diagnostics.
- `DISCORD_APPLICATION_ID` — Discord application ID for the Streamz Pro verification command.
- `DISCORD_PUBLIC_KEY` — Discord public key used to verify interaction signatures.
- `DISCORD_BOT_TOKEN` — Discord bot token used by command setup and the Worker for private bot replies. Do not expose it to frontend code.
- `DISCORD_GUILD_ID` — Optional official Streamz Discord server ID used only to clear old server commands during command registration.
- `STREAMZ_BUGS_CHANNEL_ID` — Official public Discord Bugs channel ID polled by the Worker for Streamz app bug reports.
- `STREAMZ_APP_SUPPORT_STAFF` — Optional comma-separated `googleSub:role` entries for private Streamz app support access, where role is `owner`, `admin`, or `support`.
- `STREAMZ_EXPIRED_CODE_REVIEW_STAFF` — Optional comma-separated `googleSub:role` entries for expired-code review access, where role is `owner`, `admin`, or `reviewer`.
- `STREAMZ_OWNER_GOOGLE_SUB` — Owner Google stable subject identifier for the server-side developer grant.
- `GEMINI_API_KEY` — Google AI Studio API key used only by the Worker for Bugs channel automated troubleshooting. Do not expose it to frontend code.
- `GEMINI_PRIMARY_MODEL` — Optional override for the primary troubleshooting model. Default: `gemini-3-flash-preview`.
- `GEMINI_FALLBACK_MODEL` — Optional override for the fallback troubleshooting model. Default: `gemini-2.5-flash`.

Optional Streamz OAuth Worker variables:

```
STREAMZ_TWITCH_REDIRECT_URI=https://vortex-prime-emu.com/projects/streamz/auth/twitch/callback
STREAMZ_KICK_REDIRECT_URI=https://vortex-prime-emu.com/projects/streamz/auth/kick/callback
STREAMZ_YOUTUBE_REDIRECT_URI=https://vortex-prime-emu.com/projects/streamz/auth/youtube/callback
STREAMZ_DEFAULT_DEEP_LINK=streamz://auth/callback
STREAMZ_ALLOWED_DEEP_LINK_SCHEMES=streamz
```

Set optional values in Cloudflare Worker variables if the defaults need to change. Do not put client secrets in website files, GitHub Pages files, or browser JavaScript.

## Deploy From GitHub

After the secrets are set:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu"
git push origin main
```

Then open GitHub Actions and run or re-run:

```text
Deploy Cloudflare API
```

When it works, these URLs should return JSON instead of 404:

```text
https://vortex-prime-emu.com/api/status
https://vortex-prime-emu.com/api/catalogue/store
https://vortex-prime-emu.com/api/catalogue/mods
```

## Google authentication setup

1. Create a Google Cloud OAuth 2.0 Web client ID for `https://vortex-prime-emu.com` (and `https://rileyadams05.github.io` if you preview from GitHub Pages).
2. Add the client ID value to the Worker secret `GOOGLE_OAUTH_CLIENT_ID`.
3. List every Google account (emails separated by commas) that should have full admin privileges in `GOOGLE_ADMIN_EMAILS`. You can include whole domains with entries like `@yourteam.com`.
4. Set `SESSION_SECRET` to a long random string so the Worker can sign authentication cookies securely.
5. The admin portal uses Google Identity Services. Users sign in from the portal; the Worker verifies the ID token server-side and issues a secure session cookie. Upload endpoints require a signed-in Google user, and catalogue mutations require the email to match `GOOGLE_ADMIN_EMAILS`.

## Streamz OAuth setup

The Streamz desktop app should start provider authorization through the Worker, then open the returned `authorizationUrl` in the user's browser.

Start endpoints:

```text
GET or POST https://vortex-prime-emu.com/api/streamz/auth/twitch/start
GET or POST https://vortex-prime-emu.com/api/streamz/auth/kick/start
GET or POST https://vortex-prime-emu.com/api/streamz/auth/youtube/start
```

Callback routes registered with the providers:

```text
https://vortex-prime-emu.com/projects/streamz/auth/twitch/callback
https://vortex-prime-emu.com/projects/streamz/auth/kick/callback
https://vortex-prime-emu.com/projects/streamz/auth/youtube/callback
```

For Twitch, Kick, and YouTube, the Worker generates the PKCE verifier and challenge server-side and stores the verifier inside encrypted OAuth state. The browser callback page forwards only `code` and `state` to the Worker. The Worker validates state before exchanging authorization codes. Twitch uses public-client PKCE without a client secret. Kick and YouTube use server-side token exchange with their Worker secrets.

For secure desktop token handoff, Streamz can include a random 32-byte base64url `handoffKey` and a `returnTo` deep link when calling the `start` endpoint. The Worker encrypts the provider token response with that handoff key and sends only the encrypted payload back through the deep link.

## Streamz Pro Stripe Elements checkout

The Streamz Pro intake page stays on:

```text
https://vortex-prime-emu.com/projects/streamz/pro/
```

It uses Stripe.js with the official Express Checkout Element and Payment Element. Raw card data never reaches the Worker.

The browser posts validated, signed-in contact details to:

```text
POST https://vortex-prime-emu.com/api/streamz/pro/payment-intent
```

The Worker requires a session created from a cryptographically verified Firebase ID token, validates that the submitted email matches the Firebase Google account, requires purchase terms acceptance, and creates a one-time PaymentIntent for the server-owned Streamz Pro amount:

```text
9999 AUD cents
```

The browser receives only the PaymentIntent client secret needed by Stripe Elements. It cannot choose or modify the amount.

Stripe should be configured to send webhooks to:

```text
POST https://vortex-prime-emu.com/api/streamz/pro/webhook
```

The Worker verifies the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET` before accepting the event. After a verified `payment_intent.succeeded` event for the exact Streamz Pro amount, currency, product metadata, Firebase UID, Google identity, email, name, and date of birth, the Worker creates or updates the Firebase UID entitlement with `status: "active"`. No licence key, activation pass, Discord step, email-only match, or client-controlled flag can grant Pro.

Implemented entitlement statuses:

```text
pending_payment
pending_discord_verification
active
revoked
```

Only `active` returns Pro access from the entitlement endpoint. `revoked` and missing records return no Pro access. Legacy `pending_discord_verification` purchases are migrated to `active` when their original Google identity signs into Firebase, provided a verified Stripe payment is already recorded.

Processed Stripe event IDs, Streamz Pro account records, payment history, entitlement ownership, Discord verification hashes, website verification token hashes, upgrade sessions, and rate-limit buckets are stored in the existing Drive-backed JSON database. Streamz Pro writes use a retry wrapper and every payment/webhook/verification operation is idempotent by Stripe event ID, PaymentIntent ID, entitlement ID, Discord claim state, and website token state.

The account model uses an internal account ID as the ownership key. For Google sign-in, the account also stores Google's stable subject identifier as a linked identity. Standard verified email identities can be added to the same `streamzAccounts` shape later without moving the entitlement or trusting a frontend email address.

After a verified `payment_intent.succeeded` event, the Worker records immutable payment history, creates or updates one entitlement for the server-verified Firebase UID, activates it immediately, and updates any app upgrade session. Refund, dispute, and cancellation webhooks revoke the same entitlement.

Discord interaction route:

```text
POST https://vortex-prime-emu.com/api/streamz/discord/interactions
```

Website verification route:

```text
https://vortex-prime-emu.com/projects/streamz/pro/verify-discord/?token=...
GET/POST https://vortex-prime-emu.com/api/streamz/pro/verify-discord
```

Discord requests must include valid `X-Signature-Ed25519` and `X-Signature-Timestamp` headers. The Worker verifies the raw request body against Discord's public key before accepting `/verify-pro`, `/code-expired`, or `/contact-support`. All three commands are DM-only and are rejected if used inside the server.

Register the DM slash commands from a private shell with the Discord token available only in the environment. If `DISCORD_GUILD_ID` is present, the script clears old server commands and then registers global DM commands:

```powershell
$env:DISCORD_APPLICATION_ID="1526084195263447171"
$env:DISCORD_GUILD_ID="..."
$env:DISCORD_BOT_TOKEN="..."
node tools/register-streamz-discord-command.mjs
```

The activation code expires after 20 minutes, is single-use, and is stored only as a hash. If it expires unused, the customer must directly message the Streamz bot and run `/code-expired` with the original activation-pass PDF attached. The Worker extracts the code from the PDF, confirms the code belongs to a real paid order and expired unused, then adds the request to the private expired-code review dashboard. The website verification token expires after 30 minutes, is single-use, and is stored only as a hash. The verification URL never contains Stripe IDs, Google IDs, Discord IDs, emails, internal account IDs, full names, or dates of birth.

## Streamz app support and AI troubleshooting

General Streamz app support is separate from Streamz Pro activation and expired-code review.

Support routes:

```text
https://vortex-prime-emu.com/projects/streamz/support/
GET/POST https://vortex-prime-emu.com/api/streamz/support/...
```

The Worker polls the official Discord `Bugs` channel configured by `STREAMZ_BUGS_CHANNEL_ID`, detects likely bug reports, records the Discord user, message link, channel, timestamp, app version, OS, error text, actions tried, and attachments metadata, then asks Gemini for a concise troubleshooting reply. The primary model is `gemini-3-flash-preview`; if it fails once and still cannot respond, the Worker falls back to `gemini-2.5-flash`. If both models fail, the public reply is exactly:

```text
Automated troubleshooting is temporarily unavailable. DM the Streamz bot and use /contact-support for private assistance.
```

Private support uses the DM-only `/contact-support` command. Staff manage cases through the protected support dashboard after Google sign-in. Staff replies are delivered by the official Streamz Discord bot, not by personal Discord accounts. The `/contact-support` system does not replace `/verify-pro` or `/code-expired` and does not post private cases into Discord channels.

The final Pro licence owner is Google's stable subject identifier plus the internal entitlement record. Discord is only the secure bridge used to claim the paid session.

Owner access is granted only server-side when the authenticated Google subject matches `STREAMZ_OWNER_GOOGLE_SUB`. The frontend cannot create this grant and no fake Stripe payment is created.

App entitlement route:

```text
GET https://vortex-prime-emu.com/api/streamz/pro/app-entitlement
```

The app must unlock Pro only when the authenticated backend response has `status: "active"` and `ownsPro: true`. It must not trust local config, a frontend-only flag, a manually entered email, or a hard-coded licence value.

The frontend checks ownership through:

```text
GET https://vortex-prime-emu.com/api/streamz/pro/entitlement
```

## Google Drive preparation

1. Create a Google Cloud project (or reuse an existing one).
2. Create a service account and generate a JSON key. Keep this JSON file private.
3. In Google Drive, create a root folder for the store (e.g. `Vortex Prime Store`) and inside it create sub-folders for Packages, Mods, Icons, Previews, and Readmes plus a `store-db.json` file (copy the default from the repo).
4. Share each folder and the JSON file with the service account email (Editor access).
5. Copy each folder's ID from the URL and add it as the corresponding Worker secret listed above.
6. Copy the `store-db.json` file ID and set `DRIVE_DATABASE_FILE_ID` to that value.

## Manual Deploy From Your PC

This is optional. Use it only if you want to deploy without GitHub Actions.

Install Wrangler:

```powershell
npm install -g wrangler
```

Log in:

```powershell
wrangler login
```

Deploy the API:

```powershell
wrangler deploy
```

Then test:

```powershell
curl https://vortex-prime-emu.com/api/status
```
