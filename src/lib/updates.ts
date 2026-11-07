/**
 * Detects a newer deployment by polling version.json (written at build time).
 * When one is found the page reloads itself the next time it is safe to do so:
 * right away if the app is in the background, otherwise as soon as the user
 * leaves and returns to it. `onAvailable` lets the UI offer an immediate reload.
 */
export function watchForUpdates(onAvailable: () => void, intervalMs = 60_000): () => void {
  if (import.meta.env.DEV) return () => {};
  let pending = false;

  const check = async () => {
    if (pending) return;
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (version && version !== __APP_VERSION__) {
        pending = true;
        if (document.visibilityState === 'hidden') location.reload();
        else onAvailable();
      }
    } catch {
      /* offline: try again later */
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && pending) location.reload();
    if (document.visibilityState === 'visible') check();
  };

  const id = setInterval(check, intervalMs);
  document.addEventListener('visibilitychange', onVisibility);
  check();
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
