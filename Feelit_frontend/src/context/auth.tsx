import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, SIGNED_OUT_EVENT, token } from "@/lib/api";
import { googleIdToken } from "@/lib/google";
import type { User } from "@/lib/types";

interface Auth {
  user: User | null;
  /** False until we know whether a saved session is still valid. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Signs in, or creates the account on first use. Does nothing if the user closes the Google window. */
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  saveProfile: (changes: Parameters<typeof api.updateMe>[0]) => Promise<void>;
  /** Change the password (current one required), or set a first one on a Google account. Other devices are signed out. */
  changePassword: (current: string | null, next: string) => Promise<void>;
}

/** Load the signed-in user, retrying briefly while the server wakes up (free hosting sleeps when idle). */
async function loadUser(attempt = 0): Promise<User | null> {
  try {
    return await api.me();
  } catch (error) {
    const retry = error instanceof ApiError && (error.status === 0 || error.status >= 500) && attempt < 2;
    if (!retry) return null;
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    return loadUser(attempt + 1);
  }
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!token.get());

  useEffect(() => {
    if (token.get()) loadUser().then(setUser).finally(() => setReady(true));
    const onSignedOut = () => setUser(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const start = useCallback((session: { token: string; user: User }) => {
    token.set(session.token);
    setUser(session.user);
  }, []);

  const value = useMemo<Auth>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => start(await api.login(email, password)),
      signUp: async (name, email, password) => start(await api.register(name, email, password)),
      signInWithGoogle: async () => {
        const idToken = await googleIdToken();
        if (idToken) start(await api.google(idToken));
      },
      signOut: () => {
        token.clear();
        setUser(null);
        queryClient.clear();
      },
      saveProfile: async (changes) => setUser(await api.updateMe(changes)),
      changePassword: async (current, next) => start(await api.setPassword(current, next)),
    }),
    [user, ready, start, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
