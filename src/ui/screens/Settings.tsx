import { useState, type CSSProperties } from 'react';
import { useApp } from '../AppContext';
import { PageHead } from '../App';
import { Icon } from '../icons';
import { LinkRow, Segmented, ToggleRow } from '../kit';
import { Mascot } from '../art';

/** Everyday settings first; developer tools behind the "Advanced tools" switch. */
export function SettingsScreen() {
  const { settings, updateSettings, deleteData } = useApp();
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-label="Settings">
      <PageHead title="Settings" />
      <div className="roadcase" aria-hidden="true">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <span className="stencil"><small>Road case 01</small>Backstage</span>
        <span className="sticker">Handle with care</span>
        <span className="sticker round"><Mascot mood="rock" size={52} /></span>
      </div>

      <div className="settings-grid">
      <div>
      <div className="section-title">You and your guitar</div>
      <div className="list">
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">Your guitar</div><div className="lr-sub">Tips change a little (electric: amp and volume advice, bends are easier).</div></div>
          <Segmented label="Your guitar" value={settings.instrument} options={[{ value: 'acoustic', label: 'Acoustic' }, { value: 'electric', label: 'Electric' }, { value: 'classical', label: 'Nylon' }]} onChange={(v) => updateSettings({ instrument: v })} />
        </div>
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">Coach style</div><div className="lr-sub">Jokes are extra lines; the instructions stay plain.</div></div>
          <Segmented label="Coach style" value={settings.voice} options={[{ value: 'plain', label: 'Plain' }, { value: 'funny', label: 'Funny' }, { value: 'metal', label: 'Metal' }]} onChange={(v) => updateSettings({ voice: v })} />
        </div>
      </div>

      <div className="section-title">Playing</div>
      <div className="list">
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">Which hand strums?</div><div className="lr-sub">Mirrors diagrams. String numbers never change.</div></div>
          <Segmented label="Which hand strums?" value={settings.handedness} options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]} onChange={(v) => updateSettings({ handedness: v })} />
        </div>
        <LinkRow href="#/settings/mic" icon="mic" title="Microphone" sub="Choose the mic, check the level" testId="mic-settings" />
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">How you hear the app</div><div className="lr-sub">Headphones let you hear the guide tune while you’re being checked.</div></div>
          <Segmented label="Output" value={settings.outputRoute === 'unknown' ? 'speakers' : settings.outputRoute} options={[{ value: 'headphones', label: 'Headphones' }, { value: 'speakers', label: 'Speakers' }]} onChange={(v) => updateSettings({ outputRoute: v })} />
        </div>
      </div>

      </div>
      <div>
      <div className="section-title">Sound</div>
      <div className="list">
        {([
          ['guideLevel', 'Guide tune'],
          ['metronomeLevel', 'Metronome'],
          ['referenceLevel', 'Demonstrations'],
        ] as const).map(([k, label]) => (
          <label key={k} className="listrow" style={{ cursor: 'default' }}>
            <div className="lr-main"><div className="lr-title">{label}</div></div>
            <input type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => updateSettings({ [k]: Number(e.target.value) })} aria-label={`${label} volume`} style={{ width: 160, height: 48, '--fill': `${Math.round(settings[k] * 100)}%` } as CSSProperties} />
          </label>
        ))}
      </div>

      <div className="section-title">Display</div>
      <div className="list">
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">Look</div><div className="lr-sub">Daylight paper or a dark stage.</div></div>
          <Segmented label="Look" value={settings.theme} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Day' }, { value: 'stage', label: 'Stage' }]} onChange={(v) => updateSettings({ theme: v })} />
        </div>
        <div className="listrow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="lr-main"><div className="lr-title">Motion</div><div className="lr-sub">“Less” moves notes in steps instead of scrolling.</div></div>
          <Segmented label="Motion" value={settings.reducedMotion} options={[{ value: 'system', label: 'Auto' }, { value: 'on', label: 'Less' }, { value: 'off', label: 'Smooth' }]} onChange={(v) => updateSettings({ reducedMotion: v })} />
        </div>
        <ToggleRow title="Stage effects" sub="Lights, haze and celebrations. Calmer when off." checked={settings.stageEffects} onChange={(v) => updateSettings({ stageEffects: v })} testId="stage-effects" />
        <ToggleRow title="High contrast" checked={settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} testId="high-contrast" />
      </div>
      </div>
      </div>

      <div className="section-title">Privacy</div>
      <div className="card tight t-small">
        <p>Everything stays on this device: your settings, progress and songs. Microphone sound is analysed and thrown away — never recorded or uploaded unless you press record in the mic test lab. There is no account, no tracking and no AI service.</p>
        <p style={{ margin: 0 }}>The app hears which note sounded, not which finger or string you used, and cannot tell how hard you press. Lessons are drafts not yet reviewed by a guitar teacher.</p>
      </div>

      <div className="section-title">Advanced</div>
      <div className="list">
        <ToggleRow title="Advanced tools" sub="For testing the mic and moving your data. Not needed to learn." checked={settings.advanced} onChange={(v) => updateSettings({ advanced: v })} testId="advanced-toggle" />
        {settings.advanced && (
          <>
            <LinkRow href="#/settings/lab" icon="wave" title="Mic test lab" sub="What the app hears, feedback speed, guided recordings" testId="lab-link" />
            <LinkRow href="#/settings/mic" icon="tune" title="Timing and devices" sub="Calibration, input device, browser audio processing" />
            <LinkRow href="#/settings/backup" icon="download" title="Back up and restore" sub="Export, import or delete progress; offline copy" testId="backup-link" />
            <ToggleRow title="Camera view (experimental)" sub="See your hands on screen while you play. Off by default; nothing is recorded." checked={settings.cameraLab} onChange={(v) => updateSettings({ cameraLab: v })} testId="camera-toggle" />
            {settings.cameraLab && <LinkRow href="#/camera" icon="camera" title="Open camera view" />}
          </>
        )}
      </div>

      <div className="section-title">Start over</div>
      {!confirm ? (
        <button type="button" className="btn danger block-phone" onClick={() => setConfirm(true)}><Icon name="trash" size={18} /> Erase my progress</button>
      ) : (
        <div className="callout bad">
          <div className="stack">
            <span>Erase lesson progress and practice history on this device? Your songs stay. This can’t be undone.</span>
            <div className="row">
              <button type="button" className="btn danger" onClick={() => void deleteData({ progress: true, summaries: true, settings: false }).then(() => setConfirm(false))}>Erase</button>
              <button type="button" className="btn outline" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <p className="t-caption" style={{ marginTop: 24 }}>Guitar Unhero · local-first prototype · works offline after the first visit.</p>
    </section>
  );
}
