// Website account sign-in was retired. Keep a local compatibility shim so
// stale clients fail closed without loading Firebase or contacting Google.
const retired = async () => {
  throw new Error("Website sign-in has been retired.");
};

window.StreamzFirebaseAuth = Object.freeze({
  waitForInitialSession: async () => null,
  getAuth: retired,
  signInWithGoogleIdToken: retired,
  completeProfile: retired,
  checkUsername: retired,
  signOut: async () => null,
});
