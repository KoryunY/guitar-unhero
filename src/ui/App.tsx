import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { engine } from '../audio/engine';
import { useApp } from './AppContext';
import { Icon, type IconName } from './icons';
import { Sheet, Skeleton, ToastHost } from './kit';
import { InputMeter } from './components/InputMeter';
import { Logo } from './art';
import { ListenControl } from './components/ListenControl';
import { Backdrop, useDayLook, type BackdropMood } from './Backdrop';
import { LESSONS } from '../learning/lessons';
import { chapterOf } from './coach';

const Today = lazy(() => import('./screens/Today').then((m) => ({ default: m.Today })));
const Welcome = lazy(() => import('./screens/Welcome').then((m) => ({ default: m.Welcome })));
const Learn = lazy(() => import('./screens/Learn').then((m) => ({ default: m.Learn })));
const PracticeLibrary = lazy(() => import('./screens/PracticeLibrary').then((m) => ({ default: m.PracticeLibrary })));
const PracticeScreen = lazy(() => import('./screens/Practice').then((m) => ({ default: m.PracticeScreen })));
const SongScreen = lazy(() => import('./screens/Song').then((m) => ({ default: m.SongScreen })));
const TunerScreen = lazy(() => import('./screens/Tuner').then((m) => ({ default: m.TunerScreen })));
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })));
const MicSetup = lazy(() => import('./screens/Setup').then((m) => ({ default: m.Setup })));
const Diagnostics = lazy(() => import('./screens/Diagnostics').then((m) => ({ default: m.Diagnostics })));
const DataScreen = lazy(() => import('./screens/Data').then((m) => ({ default: m.DataScreen })));
const CameraScreen = lazy(() => import('./screens/Camera').then((m) => ({ default: m.CameraScreen })));

export type RouteName = 'today' | 'welcome' | 'learn' | 'practice' | 'song' | 'tune' | 'settings' | 'camera';
export interface Route {
  name: RouteName;
  arg: string | null;
  sub: string | null;
}

const ALIASES: Record<string, string[]> = {
  home: ['today'],
  tuner: ['tune'],
  setup: ['settings', 'mic'],
  data: ['settings', 'backup'],
  diagnostics: ['settings', 'lab'],
};

export function parseHash(hash = window.location.hash): Route {
  let parts = (hash || '#/today').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] && ALIASES[parts[0]]) parts = [...ALIASES[parts[0]]!, ...parts.slice(1)];
  const known: RouteName[] = ['today', 'welcome', 'learn', 'practice', 'song', 'tune', 'settings', 'camera'];
  const name = (known.includes(parts[0] as RouteName) ? parts[0] : 'today') as RouteName;
  return { name, arg: parts[1] ?? null, sub: parts[2] ?? null };
}

/** Navigate. Back-compat: navigate('learn', id). */
export function navigate(name: string, arg?: string, sub?: string): void {
  window.location.hash = `#/${[name, arg, sub].filter(Boolean).map((x) => encodeURIComponent(x!)).join('/')}`;
}

const TABS: { name: RouteName; label: string; icon: IconName }[] = [
  { name: 'today', label: 'Today', icon: 'today' },
  { name: 'learn', label: 'Learn', icon: 'learn' },
  { name: 'practice', label: 'Practice', icon: 'practice' },
  { name: 'tune', label: 'Tune', icon: 'tune' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

function moodFor(r: Route): BackdropMood {
  if (r.name === 'tune') return 'amp';
  if (r.name === 'settings' || r.name === 'camera') return 'backstage';
  if (r.name === 'song') return 'studio';
  if (r.name === 'practice') return 'stage';
  return 'venue';
}

/** Glowing pill behind the current tab; slides between tabs (static with reduced motion). */
function useNavIndicator(nav: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    const place = () => {
      const a = el.querySelector<HTMLElement>('a[aria-current="page"]');
      const target = a && (window.matchMedia('(min-width: 1280px)').matches ? a : a.querySelector<HTMLElement>('.tab-icon'));
      if (!target) {
        el.style.setProperty('--ind-o', '0');
        return;
      }
      const n = el.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      el.style.setProperty('--ind-x', `${r.left - n.left}px`);
      el.style.setProperty('--ind-y', `${r.top - n.top}px`);
      el.style.setProperty('--ind-w', `${r.width}px`);
      el.style.setProperty('--ind-h', `${r.height}px`);
      el.style.setProperty('--ind-o', '1');
    };
    place();
    // Fonts and lazy screens can shift the rail after first paint: measure again once they settle.
    const late = window.setTimeout(place, 400);
    void document.fonts?.ready.then(place);
    window.addEventListener('resize', place);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener('resize', place);
    };
  }, [nav, key]);
}

/** Let pressable cards glow where the pointer is (CSS reads --mx / --my). */
function usePointerGlow() {
  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover)').matches) return;
    const on = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.tile, .pathnode, .choice, a.card');
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', on, { passive: true });
    return () => document.removeEventListener('pointermove', on);
  }, []);
}

function isFocus(r: Route): boolean {
  return r.name === 'welcome' || r.name === 'camera' || (r.name === 'learn' && !!r.arg) || (r.name === 'practice' && !!r.arg) || r.name === 'song';
}

/** Mic / simulation status chip; opens the listening sheet. Appears in every page header. */
export function StatusChip() {
  const { settings, mic, updateSettings } = useApp();
  const [open, setOpen] = useState(false);
  const sim = settings.inputMode === 'simulation';
  const problem = mic === 'lost' || mic === 'denied' || mic === 'busy' || mic === 'absent' || mic === 'error';
  const cls = sim ? 'chip sim' : mic === 'on' ? 'chip on' : problem ? 'chip warn' : 'chip off';
  const label = sim ? 'Simulation' : mic === 'on' ? 'Mic on' : problem ? 'Mic problem' : 'Mic off';
  return (
    <>
      <button type="button" className={cls} onClick={() => setOpen(true)} data-testid="input-status" aria-haspopup="dialog">
        <Icon name={sim ? 'flask' : mic === 'on' ? 'mic' : 'micOff'} size={18} />
        {label}
        {sim && <span className="sr-only"> — pretend playing, nothing here counts as real progress</span>}
      </button>
      {open && (
        <Sheet title={sim ? 'Simulation' : 'Listening'} onClose={() => setOpen(false)} testId="listen-sheet">
          {sim ? (
            <div className="stack">
              <p>Pretend playing: the app makes up notes so you can see how lessons and feedback work. Nothing here counts as your progress, and no microphone is used.</p>
              <button type="button" className="btn primary block" onClick={() => { updateSettings({ inputMode: 'none' }); setOpen(false); }}>
                Leave simulation
              </button>
            </div>
          ) : (
            <div className="stack">
              {mic === 'on' ? (
                <>
                  <p>The app is listening to your guitar. Sound is analysed on this device only — never recorded or uploaded.</p>
                  <InputMeter />
                  <button type="button" className="btn outline block" onClick={() => engine.stopMic()}>
                    Stop listening
                  </button>
                </>
              ) : (
                <ListenControl purpose="hear your notes and tell you what it heard" />
              )}
              <div className="section-title" style={{ marginTop: 8 }}>How do you hear the app?</div>
              <div className="segmented" role="group" aria-label="Output">
                {(['headphones', 'speakers'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={settings.outputRoute === r} onClick={() => updateSettings({ outputRoute: r })}>
                    {r === 'headphones' ? 'Headphones' : 'Speakers'}
                  </button>
                ))}
              </div>
              <p className="t-small muted">Headphones let you hear the guide tune while the mic hears only your guitar.</p>
              <a className="btn text" href="#/settings/mic" onClick={() => setOpen(false)}>
                Having trouble? Microphone settings
              </a>
              {!sim && (
                <button type="button" className="btn text" onClick={() => { updateSettings({ inputMode: 'simulation' }); setOpen(false); }}>
                  No guitar right now? Try the simulation
                </button>
              )}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

export function SoundToggle() {
  const [muted, setMuted] = useState(engine.isMuted);
  return (
    <button
      type="button"
      className="iconbtn"
      aria-pressed={muted}
      aria-label={muted ? 'App sound off' : 'App sound on'}
      title={muted ? 'App sound off' : 'App sound on'}
      onClick={() => {
        engine.setMuted(!muted);
        setMuted(!muted);
      }}
    >
      <Icon name={muted ? 'volumeOff' : 'volume'} />
    </button>
  );
}

/** Standard page header for tab screens. */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <h1 className="t-title" tabIndex={-1}>{title}</h1>
      {children}
      <StatusChip />
      <SoundToggle />
    </header>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash());
  const { settings, storageError, ready, lessons } = useApp();
  const navRef = useRef<HTMLElement>(null);
  const day = useDayLook(settings.theme);
  const current = LESSONS.find((l) => !lessons[l.lessonId]?.completedAt);
  const tier = (current && chapterOf(current.lessonId)?.tier) || (current ? 'beginner' : 'hero');
  useNavIndicator(navRef, `${route.name}:${ready}:${settings.onboarded}`);
  usePointerGlow();

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Stop listening when leaving the listening screens (AUD-05).
  useEffect(() => {
    if (route.name === 'today' || (route.name === 'settings' && route.arg !== 'mic' && route.arg !== 'lab')) engine.stopMic();
    window.scrollTo?.(0, 0);
    document.querySelector<HTMLElement>('main h1, main [role="heading"]')?.focus({ preventScroll: true });
  }, [route.name, route.arg]);

  const sim = settings.inputMode === 'simulation';
  const focus = isFocus(route) || (route.name === 'today' && ready && !settings.onboarded);

  let screen: ReactNode;
  switch (route.name) {
    case 'welcome':
      screen = <Welcome />;
      break;
    case 'learn':
      screen = <Learn lessonId={route.arg} />;
      break;
    case 'practice':
      screen = route.arg ? <PracticeScreen arrangementId={route.arg} /> : <PracticeLibrary />;
      break;
    case 'song':
      screen = <SongScreen songId={route.arg} view={route.sub} />;
      break;
    case 'tune':
      screen = <TunerScreen />;
      break;
    case 'camera':
      screen = <CameraScreen />;
      break;
    case 'settings':
      screen = route.arg === 'mic' ? <MicSetup /> : route.arg === 'lab' ? <Diagnostics /> : route.arg === 'backup' ? <DataScreen /> : <SettingsScreen />;
      break;
    default:
      screen = settings.onboarded ? <Today /> : <Welcome />;
  }

  return (
    <div className={`app${focus ? ' focus' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Backdrop tier={tier} mood={moodFor(route)} day={day} />
      {sim && <div className="sim-stripe" data-testid="sim-banner" aria-hidden="true" />}
      <nav className="tabbar" aria-label="Main" ref={navRef}>
        <span className="nav-ind" aria-hidden="true" />
        <div className="brand"><Logo size={40} /><span className="t-logo" aria-hidden="true">Guitar Unhero</span><span className="sr-only">Guitar Unhero</span></div>
        {TABS.map((t) => (
          <a key={t.name} href={`#/${t.name}`} aria-current={route.name === t.name || (t.name === 'practice' && route.name === 'song') ? 'page' : undefined}>
            <span className="tab-icon"><Icon name={t.icon} /></span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <main id="main" className="page" tabIndex={-1}>
        {storageError && <div className="callout bad" role="alert" style={{ marginBottom: 12 }}>{storageError}</div>}
        {!ready ? <Skeleton /> : <Suspense fallback={<Skeleton />}>{screen}</Suspense>}
      </main>
      <ToastHost />
    </div>
  );
}
