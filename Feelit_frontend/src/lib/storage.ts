import { useCallback, useState } from "react";

/**
 * Safe browser storage. Storage can be missing or throw (private browsing, blocked site data,
 * a full quota), so every read falls back and every write is best-effort: the app keeps working,
 * it just forgets the value after this visit.
 */
type Store = "local" | "session";

function area(store: Store): Storage | null {
  try {
    return store === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readText(key: string, store: Store = "local"): string | null {
  try {
    return area(store)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Save text; `null` removes the key. */
export function writeText(key: string, value: string | null, store: Store = "local") {
  try {
    const target = area(store);
    if (value === null) target?.removeItem(key);
    else target?.setItem(key, value);
  } catch {
    /* storage unavailable: nothing to do */
  }
}

export function readJSON<T>(key: string, fallback: T, store: Store = "local"): T {
  const raw = readText(key, store);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const writeJSON = (key: string, value: unknown, store: Store = "local") => writeText(key, JSON.stringify(value), store);

/** Like useState, but remembered on this device under `key`. */
export function useStoredState<T>(key: string, fallback: T, store: Store = "local") {
  const [value, setValue] = useState<T>(() => readJSON(key, fallback, store));
  const save = useCallback(
    (next: T) => {
      setValue(next);
      writeJSON(key, next, store);
    },
    [key, store],
  );
  return [value, save] as const;
}
