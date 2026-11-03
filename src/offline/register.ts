/** Register the offline service worker in production builds only, and report its state. */
export type OfflineState = { status: 'unsupported' | 'dev' | 'installing' | 'ready' | 'update-ready' | 'error'; version: string | null };

let state: OfflineState = { status: 'dev', version: null };
const listeners = new Set<(s: OfflineState) => void>();

function set(s: Partial<OfflineState>) {
  state = { ...state, ...s };
  listeners.forEach((fn) => fn(state));
}

export function offlineState(): OfflineState {
  return state;
}

export function onOfflineState(fn: (s: OfflineState) => void): () => void {
  listeners.add(fn);
  void refreshOfflineState();
  return () => listeners.delete(fn);
}

/** Derive the state from the live registration (no event-ordering assumptions). */
export async function refreshOfflineState(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  if (reg.waiting && navigator.serviceWorker.controller) set({ status: 'update-ready' });
  else if (reg.active?.state === 'activated') {
    set({ status: 'ready' });
    reg.active.postMessage('version');
  } else set({ status: 'installing' });
}

export async function registerOffline(): Promise<void> {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return set({ status: 'unsupported' });
  try {
    set({ status: 'installing' });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'version') set({ version: e.data.version });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => void refreshOfflineState());
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const watch = (w: ServiceWorker | null) => w?.addEventListener('statechange', () => void refreshOfflineState());
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    await navigator.serviceWorker.ready;
    await refreshOfflineState();
  } catch {
    set({ status: 'error' });
  }
}

export async function checkForUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  await reg?.update();
  await refreshOfflineState();
}

export async function applyUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  reg?.waiting?.postMessage('skipWaiting');
}
