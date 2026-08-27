"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "bfr-starred-simulations";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeRaw(raw: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // e.g. storage disabled/full in private browsing -- the toggle just
    // won't persist across reloads, not worth surfacing an error for.
  }
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): string {
  return "[]";
}

/** Persists starred job_names in localStorage -- a client-only preference,
 * not synced anywhere except across tabs of the same browser (via the
 * `storage` event). Uses useSyncExternalStore, same pattern as
 * useColorMode, so there's no server/client hydration mismatch and no
 * setState-in-effect. */
export function useStarred() {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  const starred = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const isStarred = useCallback((jobName: string) => starred.has(jobName), [starred]);

  const toggleStarred = useCallback((jobName: string) => {
    const current = new Set<string>(starred);
    if (current.has(jobName)) current.delete(jobName);
    else current.add(jobName);
    writeRaw(JSON.stringify([...current]));
  }, [starred]);

  return { starred, isStarred, toggleStarred };
}
