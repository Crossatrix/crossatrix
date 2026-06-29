import { useEffect, useRef } from "react";

/**
 * Lightweight device-side cache + global refresh signal.
 *
 * Data is persisted to localStorage so it survives reloads and is shown
 * instantly without hitting the backend. Network fetches only happen on the
 * first ever load (no cache) or when the user presses the Refresh button,
 * which calls `triggerRefresh()`. This keeps cloud usage to a minimum.
 */

const PREFIX = "cx-cache:";

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore quota / serialization errors */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notify every mounted component to re-fetch its data from the backend. */
export function triggerRefresh(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

/**
 * Register a callback that runs whenever a global refresh is triggered.
 * The latest callback is always used, so it doesn't need to be memoized.
 */
export function useRefreshSignal(cb: () => void): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const listener = () => ref.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
