import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { navigate } from '../App';
import { Callout, toast, TopBar } from '../kit';
import { Icon } from '../icons';
import { calibrationHomography, fretPosition, fretRegion, isFresh, apply, type Calibration, type Pt, type RegionEvidence } from '../../vision/fretboard';
import { detectHands, HAND_MODEL, INDEX_TIP, loadHands, WASM_APPROX_MB, type HandObservation } from '../../vision/hands';

const CORNER_LABELS = ['the nut, at the thickest string (6)', 'the nut, at the thinnest string (1)', 'fret 5, at the thinnest string (1)', 'fret 5, at the thickest string (6)'];
const STORE_KEY = 'gu.camera.calibration';

function loadCal(): Calibration | null {
  try {
    const s = localStorage.getItem(STORE_KEY);
    return s ? (JSON.parse(s) as Calibration) : null;
  } catch {
    return null;
  }
}

/**
 * Experimental camera view (M5): a mirror to watch your hands, an optional
 * fretboard calibration and optional hand tracking that can say only
 * "hand visible" and a rough fret region. It never grades and never claims
 * finger contact, the string pressed, or pressure.
 */
export function CameraScreen() {
  const { settings } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);
  const [marking, setMarking] = useState<Pt[] | null>(null);
  const [cal, setCal] = useState<Calibration | null>(loadCal);
  const [tracking, setTracking] = useState<'off' | 'loading' | 'on' | 'error'>('off');
  const [obs, setObs] = useState<HandObservation | null>(null);
  const [now, setNow] = useState(performance.now());

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
    setTracking((t) => (t === 'on' ? 'off' : t));
  };
  useEffect(() => stop, []);

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => undefined);
      }
      setOn(true);
    } catch (e) {
      const n = (e as { name?: string }).name;
      setError(n === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar (camera icon), then try again.' : n === 'NotFoundError' ? 'No camera was found.' : 'The camera could not start. It may be in use by another app.');
    }
  };

  // Tracking loop at ~5 frames per second (drops frames instead of queueing).
  useEffect(() => {
    if (tracking !== 'on' || !on) return;
    let alive = true;
    let busy = false;
    const id = window.setInterval(async () => {
      const v = videoRef.current;
      if (!alive || busy || !v || v.readyState < 2) return;
      busy = true;
      try {
        const lm = await loadHands();
        setObs(detectHands(lm, v, performance.now()));
      } catch {
        setTracking('error');
      }
      busy = false;
    }, 200);
    const tick = window.setInterval(() => setNow(performance.now()), 250);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [tracking, on]);

  const H = cal ? calibrationHomography(cal) : null;
  const fresh = obs && isFresh(obs.producedAtMs, now);
  // Fretting hand = the hand whose index tip is closest to the marked board (or the first hand).
  let tip: Pt | null = null;
  if (fresh && obs!.hands.length) {
    const tips = obs!.hands.map((h) => h.landmarks[INDEX_TIP]).filter((p): p is Pt => !!p);
    tip = H ? tips.map((p) => ({ p, b: apply(H, p) })).sort((a, b) => Math.abs((a.b?.x ?? 9) - 0.5) - Math.abs((b.b?.x ?? 9) - 0.5))[0]?.p ?? null : tips[0] ?? null;
  }
  const region: RegionEvidence | null = tracking === 'on' && H ? fretRegion(H, tip) : null;

  // Draw overlay: board outline, fret lines, marks, fingertip.
  useEffect(() => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const W = (c.width = c.clientWidth * (window.devicePixelRatio || 1));
    const Hh = (c.height = c.clientHeight * (window.devicePixelRatio || 1));
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, Hh);
    const toScreen = (p: Pt) => ({ x: (mirror ? 1 - p.x : p.x) * W, y: p.y * Hh });
    g.lineWidth = 3;
    if (!cal && !marking) {
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.setLineDash([10, 8]);
      g.strokeRect(W * 0.15, Hh * 0.3, W * 0.7, Hh * 0.4);
      g.setLineDash([]);
    }
    if (cal && H) {
      const corners = cal.corners.map(toScreen);
      g.strokeStyle = '#7d93ff';
      g.beginPath();
      corners.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.stroke();
      // Fret lines by interpolating along the two marked edges.
      for (let n = 1; n < 5; n++) {
        const f = fretPosition(n);
        const a = { x: cal.corners[0].x + (cal.corners[3].x - cal.corners[0].x) * f, y: cal.corners[0].y + (cal.corners[3].y - cal.corners[0].y) * f };
        const b = { x: cal.corners[1].x + (cal.corners[2].x - cal.corners[1].x) * f, y: cal.corners[1].y + (cal.corners[2].y - cal.corners[1].y) * f };
        const sa = toScreen(a);
        const sb = toScreen(b);
        g.strokeStyle = 'rgba(125,147,255,0.6)';
        g.beginPath();
        g.moveTo(sa.x, sa.y);
        g.lineTo(sb.x, sb.y);
        g.stroke();
      }
    }
    (marking ?? []).forEach((p, i) => {
      const s = toScreen(p);
      g.fillStyle = '#ffd400';
      g.beginPath();
      g.arc(s.x, s.y, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#000';
      g.font = 'bold 14px system-ui';
      g.fillText(String(i + 1), s.x - 4, s.y + 5);
    });
    if (tip) {
      const s = toScreen(tip);
      g.fillStyle = '#4cc27a';
      g.beginPath();
      g.arc(s.x, s.y, 12, 0, Math.PI * 2);
      g.fill();
    }
  });

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!marking) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (mirror) x = 1 - x; // store un-mirrored image coordinates
    const next = [...marking, { x, y }];
    if (next.length === 4) {
      const c: Calibration = { corners: next as Calibration['corners'], createdAt: new Date().toISOString() };
      if (!calibrationHomography(c)) {
        toast('Those marks are too close together — try again');
        setMarking([]);
        return;
      }
      setCal(c);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(c));
      } catch {
        /* storage unavailable: keep for this session */
      }
      setMarking(null);
      toast('Fretboard marked');
    } else setMarking(next);
  };

  if (!settings.cameraLab) {
    return (
      <section className="stack">
        <TopBar title="Camera view" back={() => navigate('settings')} />
        <Callout>The camera view is an experiment. Turn it on in Settings → Advanced tools.</Callout>
      </section>
    );
  }

  return (
    <section className="stack" aria-label="Camera view">
      <TopBar title="Camera view (experimental)" back={() => { stop(); navigate('settings'); }} />
      <Callout kind="sim">
        A mirror to watch your hands while you play. Video stays on this device and is never recorded. The camera can’t tell which string you press, whether a finger touches it, or how hard — so this view never grades you.
      </Callout>
      <div className="camera-wrap">
        <video ref={videoRef} playsInline muted style={{ transform: mirror ? 'scaleX(-1)' : undefined }} aria-label="Your camera" />
        <canvas ref={canvasRef} onPointerDown={onTap} style={{ cursor: marking ? 'crosshair' : 'default' }} aria-hidden="true" />
        {!on && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', padding: 16, textAlign: 'center' }}>
            <div className="stack" style={{ alignItems: 'center' }}>
              <Icon name="camera" size={40} />
              <button type="button" className="btn primary" onClick={() => void start()} data-testid="camera-start">Turn on camera</button>
            </div>
          </div>
        )}
      </div>
      {error && <Callout kind="bad">{error}</Callout>}
      {on && (
        <>
          <div className="row">
            <button type="button" className="btn outline" onClick={stop}>Turn off camera</button>
            <button type="button" className="btn outline" aria-pressed={mirror} onClick={() => setMirror((m) => !m)}>{mirror ? 'Mirrored view' : 'Unmirrored view'}</button>
          </div>
          <div className="card stack">
            <div className="t-card">1. Frame it</div>
            <p className="t-small" style={{ margin: 0 }}>Point the camera at the first frets and your fretting hand, from a little above. Good light helps.</p>
            <div className="t-card">2. Mark the fretboard (optional)</div>
            {marking ? (
              <Callout kind="info">Tap on the video: <strong>{CORNER_LABELS[marking.length]}</strong> ({marking.length + 1} of 4).</Callout>
            ) : (
              <div className="row">
                <button type="button" className="btn tonal" onClick={() => setMarking([])} data-testid="camera-mark">{cal ? 'Mark again' : 'Mark the fretboard'}</button>
                {cal && <button type="button" className="btn text" onClick={() => { setCal(null); try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ } }}>Clear marks</button>}
              </div>
            )}
            <div className="t-card">3. Hand tracking (optional)</div>
            {tracking === 'off' && (
              <>
                <p className="t-small" style={{ margin: 0 }}>Uses an on-device hand model (about {Math.round(HAND_MODEL.approxMB + WASM_APPROX_MB)} MB, loaded once from this app). It can say whether it sees your hand and, after marking, roughly which fret area your index fingertip is over.</p>
                <button type="button" className="btn tonal" onClick={() => { setTracking('loading'); loadHands().then(() => setTracking('on'), () => setTracking('error')); }} data-testid="camera-track">Start hand tracking</button>
              </>
            )}
            {tracking === 'loading' && <p className="t-small">Loading the hand model…</p>}
            {tracking === 'error' && <Callout kind="bad">Hand tracking could not start on this device. The mirror still works.</Callout>}
            {tracking === 'on' && (
              <div className="stack" aria-live="polite" data-testid="camera-evidence">
                <div className="row"><Icon name={fresh && obs!.hands.length ? 'check' : 'question'} /> {fresh ? (obs!.hands.length ? `Hand${obs!.hands.length > 1 ? 's' : ''} in view` : "I can't see your hand") : 'Waiting for the camera…'}</div>
                {H ? region && <div className="row"><Icon name="hand" /> {region.text} <span className="badge">experimental</span></div> : <p className="t-small muted" style={{ margin: 0 }}>Mark the fretboard to see a rough fret area.</p>}
                <button type="button" className="btn text" onClick={() => setTracking('off')}>Stop hand tracking</button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
