import {
  getApp,
  getApps,
  initializeApp,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

let authPromise;

async function getConfiguredAuth() {
  if (!authPromise) {
    authPromise = (async () => {
      const response = await fetch('/api/auth/config', { credentials: 'include', cache: 'no-store' });
      const config = await response.json();
      if (!response.ok || !config.firebase) throw new Error('Firebase Authentication is not configured.');
      const app = getApps().length ? getApp() : initializeApp(config.firebase);
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
          const session = await createServerSession(await user.getIdToken());
          window.dispatchEvent(new CustomEvent('streamz-auth-restored', { detail: { user, session } }));
        } catch (error) {
          console.error('Unable to restore the secure Streamz session.', error);
        }
      });
      return auth;
    })();
  }
  return authPromise;
}

async function signInWithGoogleIdToken(googleIdToken) {
  if (!googleIdToken) throw new Error('Google did not return a credential.');
  const auth = await getConfiguredAuth();
  const result = await signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken));
  const idToken = await result.user.getIdToken(true);
  const data = await createServerSession(idToken);
  return { ...data, firebaseUser: result.user };
}

async function createServerSession(idToken) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Unable to create a secure Streamz session.');
  return data;
}

async function checkUsername(setupToken, username) {
  const response = await fetch('/api/auth/username/check', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupToken, username }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Unable to check that username.');
  return data;
}

async function completeProfile(profile) {
  const response = await fetch('/api/auth/complete-profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile || {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Unable to complete your account.');
  return data;
}

async function signOutEverywhere() {
  const auth = await getConfiguredAuth();
  await Promise.allSettled([
    signOut(auth),
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }),
  ]);
}

async function subscribe(callback) {
  const auth = await getConfiguredAuth();
  return onAuthStateChanged(auth, callback);
}

window.StreamzFirebaseAuth = {
  getAuth: getConfiguredAuth,
  signInWithGoogleIdToken,
  checkUsername,
  completeProfile,
  signOut: signOutEverywhere,
  subscribe,
};
window.dispatchEvent(new Event('streamz-firebase-ready'));
