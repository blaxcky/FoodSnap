export async function forceFreshAppLoad() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('refresh', Date.now().toString());

  const cacheReset = typeof caches !== 'undefined'
    ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    : Promise.resolve([]);

  const unregisterWorkers = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update();
            } catch {
              // Ignore update failures; the goal is to detach stale workers.
            }

            try {
              await registration.unregister();
            } catch {
              // Ignore unregister failures and continue with the reload.
            }
          })
        );
      })
    : Promise.resolve();

  await Promise.allSettled([cacheReset, unregisterWorkers]);
  window.location.replace(currentUrl.toString());
}

export function consumeLaunchAction() {
  const currentUrl = new URL(window.location.href);
  const launchAction = currentUrl.searchParams.get('launch');

  if (launchAction !== 'photo') {
    return null;
  }

  currentUrl.searchParams.delete('launch');
  window.history.replaceState({}, '', currentUrl.toString());
  return launchAction;
}

export function clearRefreshQueryParam() {
  const currentUrl = new URL(window.location.href);

  if (!currentUrl.searchParams.has('refresh')) {
    return;
  }

  currentUrl.searchParams.delete('refresh');
  window.history.replaceState({}, '', currentUrl.toString());
}
