import { lazy, Suspense, useEffect, useState } from 'react';
import { engine } from '../audio/engine';
import { useApp } from './AppContext';
import { Home } from './screens/Home';
// Screens load on demand so the first paint stays small.
const Setup = lazy(() => import('./screens/Setup').then((m) => ({ default: m.Setup })));
const TunerScreen = lazy(() => import('./screens/Tuner').then((m) => ({ default: m.TunerScreen })));
const Learn = lazy(() => import('./screens/Learn').then((m) => ({ default: m.Learn })));
const PracticeScreen = lazy(() => import('./screens/Practice').then((m) => ({ default: m.PracticeScreen })));
const DataScreen = lazy(() => import('./screens/Data').then((m) => ({ default: m.DataScreen })));

export type Route = { name: 'home' | 'setup' | 'tuner' | 'learn' | 'practice' | 'data'; arg: string | null };

function parseHash(): Route {
  const [, name = 'home', arg = null] = (window.location.hash || '#/home').split('/');
  const known = ['home', 'setup', 'tuner', 'learn', 'practice', 'data'];
  return { name: (known.includes(name) ? name : 'home') as Route['name'], arg: arg ? decodeURIComponent(arg) : null };
}

export function navigate(name: Route['name'], arg?: string): void {
  window.location.hash = `#/${name}${arg ? `/${encodeURIComponent(arg)}` : ''}`;
}

const NAV: { name: Route['name']; label: string }[] = [
  { name: 'home', label: 'Home' },
  { name: 'setup', label: 'Setup' },
  { name: 'tuner', label: 'Tuner' },
  { name: 'learn', label: 'Learn' },
  { name: 'practice', label: 'Practice' },
  { name: 'data', label: 'Settings & data' },
];

export function App() {
  const [route, setRoute] = useState<Route>(parseHash());
  const { settings, mic, storageError, ready, updateSettings } = useApp();
  const [muted, setMuted] = useState(engine.isMuted);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Stop listening when leaving the listening screens (AUD-05).
  useEffect(() => {
    if (route.name === 'home' || route.name === 'data') engine.stopMic();
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [route.name]);

  const sim = settings.inputMode === 'simulation';
  const listening = mic === 'on';

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {sim && (
        <div className="sim-banner" role="status" data-testid="sim-banner">
          SIMULATION MODE — no microphone is used. Results are simulated and never count as real assessment.{' '}
          <button onClick={() => updateSettings({ inputMode: 'none' })} style={{ marginLeft: 8 }}>Leave simulation</button>
        </div>
      )}
      <header className="app-header">
        <span className="brand">Guitar Unhero</span>
        <nav className="main-nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.name} href={`#/${n.name}`} aria-current={route.name === n.name ? 'page' : undefined}>{n.label}</a>
          ))}
        </nav>
        <div className="header-status">
          {sim ? (
            <span className="pill sim" data-testid="input-status">Simulation — not real listening</span>
          ) : listening ? (
            <span className="pill on" data-testid="input-status">● Listening (mic on)</span>
          ) : mic === 'lost' || mic === 'denied' || mic === 'busy' || mic === 'absent' ? (
            <span className="pill warn" data-testid="input-status">Mic problem — see Setup</span>
          ) : (
            <span className="pill off" data-testid="input-status">Not listening</span>
          )}
          {listening && <button onClick={() => engine.stopMic()}>Stop listening</button>}
          <button aria-pressed={muted} onClick={() => { engine.setMuted(!muted); setMuted(!muted); }}>{muted ? 'Sound muted' : 'Mute app sound'}</button>
        </div>
      </header>
      {storageError && <div className="callout bad" role="alert" style={{ margin: 8 }}>{storageError}</div>}
      <main id="main" tabIndex={-1}>
        {!ready ? <p>Loading…</p> : (
          <Suspense fallback={<p>Loading…</p>}>
            {route.name === 'home' && <Home />}
            {route.name === 'setup' && <Setup />}
            {route.name === 'tuner' && <TunerScreen />}
            {route.name === 'learn' && <Learn lessonId={route.arg} />}
            {route.name === 'practice' && <PracticeScreen arrangementId={route.arg} />}
            {route.name === 'data' && <DataScreen />}
          </Suspense>
        )}
      </main>
    </>
  );
}
