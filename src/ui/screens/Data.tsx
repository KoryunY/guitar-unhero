import { useEffect, useRef, useState } from 'react';
import { applyUpdate, checkForUpdate, offlineState, onOfflineState, type OfflineState } from '../../offline/register';
import { useApp } from '../AppContext';
import { buildExport, parseImport } from '../../storage/exchange';
import { SummaryCard } from '../practice/SummaryCard';
import { LESSONS } from '../../learning/lessons';

export function DataScreen() {
  const { settings, updateSettings, lessons, summaries, deleteData, importData } = useApp();
  const [msg, setMsg] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const [del, setDel] = useState({ progress: true, summaries: true, settings: false });
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [offline, setOffline] = useState<OfflineState>(offlineState());
  useEffect(() => onOfflineState(setOffline), []);

  const doExport = () => {
    const manifest = buildExport(settings, Object.values(lessons), summaries);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `guitar-unhero-progress-${manifest.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg({ kind: 'good', text: 'Progress exported. The file contains settings, lesson evidence and practice summaries — no audio and no device names.' });
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const r = parseImport(text);
    if (!r.ok) {
      setMsg({ kind: 'bad', text: `Import rejected, nothing changed: ${r.errors.join(' ')}` });
      return;
    }
    if (!window.confirm('Replace the progress stored in this browser with the imported file?')) return;
    try {
      await importData(r.settings, r.lessons, r.summaries);
      setMsg({ kind: 'good', text: `Imported ${r.lessons.length} lesson records and ${r.summaries.length} practice summaries. Self-checks and simulated results keep their labels.` });
    } catch (e) {
      setMsg({ kind: 'bad', text: `Import could not be saved: ${(e as Error).message}` });
    }
  };

  const doDelete = async () => {
    await deleteData(del);
    setConfirmDel(false);
    setMsg({ kind: 'good', text: 'Selected local data deleted from this browser.' });
  };

  return (
    <section aria-labelledby="data-h">
      <h1 id="data-h">Settings &amp; data</h1>
      {msg && <p className={`callout ${msg.kind}`} role="status" data-testid="data-msg">{msg.text}</p>}
      <div className="grid2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Display</h2>
          <fieldset>
            <legend>Handedness</legend>
            <label><input type="radio" name="h2" checked={settings.handedness === 'right'} onChange={() => updateSettings({ handedness: 'right' })} /> Right-handed guitar</label>{' '}
            <label><input type="radio" name="h2" checked={settings.handedness === 'left'} onChange={() => updateSettings({ handedness: 'left' })} /> Left-handed guitar (mirrored diagrams)</label>
          </fieldset>
          <fieldset>
            <legend>Motion</legend>
            {(['system', 'on', 'off'] as const).map((m) => (
              <label key={m} style={{ marginRight: 12 }}><input type="radio" name="rm" checked={settings.reducedMotion === m} onChange={() => updateSettings({ reducedMotion: m })} /> {m === 'system' ? 'Follow system' : m === 'on' ? 'Reduced (step mode)' : 'Smooth'}</label>
            ))}
          </fieldset>
          <label><input type="checkbox" checked={settings.highContrast} onChange={(e) => updateSettings({ highContrast: e.target.checked })} /> High contrast</label>
          <h3>Sound</h3>
          <label className="small" style={{ display: 'block' }}>Reference/demo volume <input type="range" min={0} max={1} step={0.05} value={settings.referenceLevel} onChange={(e) => updateSettings({ referenceLevel: Number(e.target.value) })} /></label>
          <label className="small" style={{ display: 'block' }}>Guide volume <input type="range" min={0} max={1} step={0.05} value={settings.guideLevel} onChange={(e) => updateSettings({ guideLevel: Number(e.target.value) })} /></label>
          <label className="small" style={{ display: 'block' }}>Metronome volume <input type="range" min={0} max={1} step={0.05} value={settings.metronomeLevel} onChange={(e) => updateSettings({ metronomeLevel: Number(e.target.value) })} /></label>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Your data</h2>
          <p className="small">Stored only in this browser: settings, lesson steps (with how each was evidenced: heard, self-check or simulation) and practice summaries. No audio is ever stored or uploaded. Clearing browser data or using another device starts fresh — export to keep a copy.</p>
          <div className="row">
            <button className="primary" onClick={doExport} data-testid="export">Export progress</button>
            <button onClick={() => fileRef.current?.click()}>Import progress…</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          </div>
          <h3>Delete local data</h3>
          <label style={{ display: 'block' }}><input type="checkbox" checked={del.progress} onChange={(e) => setDel({ ...del, progress: e.target.checked })} /> Lesson progress</label>
          <label style={{ display: 'block' }}><input type="checkbox" checked={del.summaries} onChange={(e) => setDel({ ...del, summaries: e.target.checked })} /> Practice summaries</label>
          <label style={{ display: 'block' }}><input type="checkbox" checked={del.settings} onChange={(e) => setDel({ ...del, settings: e.target.checked })} /> Settings and calibration</label>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} disabled={!del.progress && !del.summaries && !del.settings}>Delete selected…</button>
          ) : (
            <div className="row callout bad">
              <span>This cannot be undone.</span>
              <button onClick={doDelete} data-testid="confirm-delete">Delete now</button>
              <button onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Progress</h2>
        <ul data-testid="lesson-progress">
          {LESSONS.map((l) => {
            const p = lessons[l.lessonId];
            return (
              <li key={l.lessonId}>
                {l.title}: {p ? `${p.completedSteps.length}/${l.steps.length} steps${p.completedAt ? `, completed (${p.completionEvidence?.replace('_', ' ')})` : ''}` : 'not started'}
                {p?.imported ? ' — imported' : ''}
              </li>
            );
          })}
        </ul>
        <h3>Recent practice</h3>
        {summaries.length === 0 ? <p className="muted">No practice summaries yet.</p> : summaries.slice(0, 5).map((s) => (
          <div key={s.id}>
            <p className="small muted">{new Date(s.finishedAt).toLocaleString()} — {s.title}{s.imported ? ' (imported)' : ''}</p>
            <SummaryCard record={s} />
          </div>
        ))}
      </div>
      <div className="panel small">
        <h2 style={{ marginTop: 0 }}>Offline use</h2>
        <p data-testid="offline-status">
          {offline.status === 'ready' && `Saved for offline use (version ${offline.version ?? '…'}). After this first visit the app works without internet.`}
          {offline.status === 'installing' && 'Saving the app for offline use…'}
          {offline.status === 'update-ready' && 'A newer version is downloaded.'}
          {offline.status === 'dev' && 'Offline copy is only made by the production build (pnpm build && pnpm preview).'}
          {offline.status === 'unsupported' && 'This browser cannot keep an offline copy.'}
          {offline.status === 'error' && 'The offline copy could not be saved.'}
        </p>
        <div className="row">
          <button onClick={() => void checkForUpdate()} disabled={offline.status === 'dev' || offline.status === 'unsupported'}>Check for update</button>
          {offline.status === 'update-ready' && <button className="primary" onClick={() => void applyUpdate()}>Use the new version</button>}
        </div>
      </div>
      <div className="panel small">
        <h2 style={{ marginTop: 0 }}>Privacy and limits</h2>
        <ul>
          <li>Microphone audio is analyzed in memory on this device and discarded. Nothing is uploaded; there is no account, analytics or AI service.</li>
          <li>Pitch shows which note sounded, not which string, finger or fret you used, and not how hard you pressed.</li>
          <li>Timing feedback is approximate unless calibrated for your current input and output.</li>
          <li>Lessons are original drafts that have not yet been reviewed by a guitar teacher.</li>
        </ul>
      </div>
    </section>
  );
}
