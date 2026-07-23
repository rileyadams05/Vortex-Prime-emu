import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../docs/projects/streamz/pro/index.html', import.meta.url), 'utf8');
const site = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const authClient = await readFile(new URL('../docs/assets/js/streamz-firebase-auth.js', import.meta.url), 'utf8');

assert.match(worker, /validateFirebaseIdToken\(idToken, env\)/, 'backend verifies Firebase ID tokens');
assert.match(worker, /payload\.aud !== projectId/, 'backend binds ID tokens to the configured Firebase project');
assert.match(worker, /payload\.iss !== `https:\/\/securetoken\.google\.com\/\$\{projectId\}`/, 'backend verifies Firebase issuer');
assert.match(worker, /firebaseProvider !== 'google\.com'/, 'backend restricts Streamz sign-in to Google accounts');
assert.match(worker, /metadata\[firebase_uid\]/, 'checkout writes verified Firebase UID into Stripe metadata');
assert.match(worker, /missing_firebase_uid/, 'webhook rejects payments without a Firebase UID');
assert.match(worker, /status: 'active'/, 'verified successful payment activates Pro');
assert.match(worker, /verifyStripeWebhookSignature\(rawPayload, signature, webhookSecret\)/, 'webhook signature is verified before entitlement writes');
assert.match(worker, /firebaseUid\s*\?\s*entry\.firebaseUid === firebaseUid/, 'entitlements are looked up by Firebase UID');
assert.match(worker, /authorization\.startsWith\('Bearer '\)/, 'native clients can authenticate with Firebase bearer tokens');
assert.match(worker, /Streamz Pro is required for this feature/, 'protected Streamz backend features enforce Pro server-side');
assert.match(authClient, /browserLocalPersistence/, 'Firebase login persists across app restarts');
assert.match(authClient, /user\.getIdToken\(\)/, 'persisted Firebase sessions refresh the server session');
assert.match(authClient, /signOut\(auth\)/, 'sign-out clears Firebase state');
assert.match(checkout, /signInWithGoogleIdToken/, 'existing checkout signs in through Firebase');
assert.match(site, /streamz-firebase-auth\.js/, 'existing website loads Firebase Authentication');
assert.doesNotMatch(checkout, /body: JSON\.stringify\(\{ credential: response\.credential \}\)/, 'checkout no longer authenticates directly with a Google token');

console.log('Streamz Firebase entitlement integration tests passed.');
