/**
 * Google sign-in through Firebase. Firebase is used only to show Google's account picker and
 * hand back a signed ID token; the Feel It backend verifies that token and owns the session.
 * The Firebase SDK is loaded on demand, so it costs nothing until someone taps the button.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Codes Firebase raises when the user simply closes or re-opens the popup. */
const DISMISSED = ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"];

/** Opens Google's account picker. Resolves with an ID token, or null if the user closed it. */
export async function googleIdToken(): Promise<string | null> {
  const [{ getApps, initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const auth = getAuth(getApps()[0] ?? initializeApp(config));
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await user.getIdToken();
    await signOut(auth); // our own session takes over from here
    return idToken;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (DISMISSED.includes(code)) return null;
    throw new Error(code === "auth/popup-blocked" ? "Your browser blocked the Google window. Allow pop-ups for this site and try again." : "Google sign-in didn't complete. Please try again.");
  }
}
