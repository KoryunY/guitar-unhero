import { useState } from 'react';
import { engine } from '../../audio/engine';
import { useApp } from '../AppContext';
import { navigate } from '../App';
import { Icon } from '../icons';
import { Callout } from '../kit';
import { Coach, GuitarIcon, Logo, Mascot, StageArt, type Mood } from '../art';
import type { InstrumentChoice, VoiceChoice } from '../../storage/types';

const GUITARS: { value: InstrumentChoice; label: string }[] = [
  { value: 'acoustic', label: 'Acoustic' },
  { value: 'electric', label: 'Electric' },
  { value: 'classical', label: 'Nylon' },
];
const VOICES: { value: VoiceChoice; label: string; mood: Mood }[] = [
  { value: 'plain', label: 'Plain', mood: 'think' },
  { value: 'funny', label: 'Funny', mood: 'happy' },
  { value: 'metal', label: 'Metal', mood: 'rock' },
];
import { InputMeter } from '../components/InputMeter';

type Step = 'hello' | 'start' | 'mic' | 'output' | 'done';

/** First-run flow: hand → how to start → mic check → headphones/speakers → first steps. */
export function Welcome() {
  const { settings, updateSettings, mic } = useApp();
  const [step, setStep] = useState<Step>('hello');
  const [busy, setBusy] = useState(false);
  const order: Step[] = ['hello', 'start', 'mic', 'output', 'done'];
  const idx = order.indexOf(step);

  const finish = (to: 'tune' | 'lesson') => {
    updateSettings({ onboarded: true });
    if (to === 'tune') navigate('tune');
    else navigate('learn', 'lesson.meet-guitar.v1');
  };
  const startMic = async () => {
    setBusy(true);
    updateSettings({ inputMode: 'microphone' });
    await engine.startMic(settings.deviceId);
    setBusy(false);
  };

  return (
    <div className="welcome">
    <aside className="welcome-art" aria-hidden="true">
      <div className="card stage">
        <StageArt className="stage-art" />
        <div className="stage-body">
          <div className="row nowrap"><Logo size={56} /><span className="t-logo">Guitar Unhero</span></div>
          <div className="kicker">Your first gig starts here</div>
          <h2>From the bedroom to the stadium.</h2>
        </div>
      </div>
      <div className="card welcome-promises">
        <Mascot mood={settings.voice === 'metal' ? 'rock' : settings.voice === 'plain' ? 'think' : 'happy'} size={96} />
        <ul>
          <li><Icon name="ear" size={22} />Hear it, see it, play it: one clear move at a time.</li>
          <li><Icon name="lock" size={22} />No account. Nothing leaves this device.</li>
          <li><Icon name="practice" size={22} />Any song you love, played Easy, Medium or Full.</li>
        </ul>
      </div>
    </aside>
    <section aria-labelledby="welcome-h" className="stack" style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
      <div className="steps-bar" aria-hidden="true">
        {order.map((s, i) => <i key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} />)}
      </div>

      {step === 'hello' && (
        <>
          <div className="card stage hello-hero" style={{ minHeight: 0 }}>
            <StageArt className="stage-art" />
            <div className="stage-body" style={{ minHeight: 200 }}>
              <div className="row nowrap"><Logo size={44} /><span className="t-logo" style={{ fontSize: 30, lineHeight: '32px' }}>Guitar Unhero</span></div>
              <p>From the bedroom to the stadium. Bring a guitar and a sense of humour.</p>
            </div>
          </div>
          <h1 id="welcome-h" className="t-display" tabIndex={-1}>Welcome — you can start here.</h1>
          <p className="t-body">Guitar Unhero is a patient teacher for your real guitar. One clear movement at a time: hear it, see it, play it, adjust one thing.</p>
          <p className="t-small muted">No account. Your progress stays on this device. The microphone is optional and never records or uploads.</p>
          <div className="section-title">Which hand strums?</div>
          <div className="stack" role="radiogroup" aria-label="Which hand strums?">
            <button type="button" role="radio" className="choice" aria-checked={settings.handedness === 'right'} onClick={() => updateSettings({ handedness: 'right' })}>
              <span className="hand" aria-hidden="true"><Icon name="hand" /></span>
              <div><div className="c-title">Right hand</div><div className="c-sub">Most people. Your left hand presses the strings.</div></div>
            </button>
            <button type="button" role="radio" className="choice" aria-checked={settings.handedness === 'left'} onClick={() => updateSettings({ handedness: 'left' })}>
              <span className="hand mirror" aria-hidden="true"><Icon name="hand" /></span>
              <div><div className="c-title">Left hand</div><div className="c-sub">Diagrams are mirrored for you. String numbers stay the same.</div></div>
            </button>
          </div>
          <div className="section-title">Your guitar</div>
          <div className="pick-row" role="radiogroup" aria-label="Your guitar">
            {GUITARS.map((g) => (
              <button key={g.value} type="button" role="radio" className="pick-tile" aria-checked={settings.instrument === g.value} onClick={() => updateSettings({ instrument: g.value })}>
                <GuitarIcon kind={g.value} />{g.label}
              </button>
            ))}
          </div>
          <div className="section-title">Coach style</div>
          <div className="pick-row" role="radiogroup" aria-label="Coach style">
            {VOICES.map((v) => (
              <button key={v.value} type="button" role="radio" className="pick-tile" aria-checked={settings.voice === v.value} onClick={() => updateSettings({ voice: v.value })}>
                <Mascot mood={v.mood} size={56} />{v.label}
              </button>
            ))}
          </div>
          <Coach mood={settings.voice === 'metal' ? 'rock' : settings.voice === 'funny' ? 'happy' : 'think'}>
            <p>{settings.voice === 'plain' ? 'Just the facts. I will keep it short and clear.' : settings.voice === 'funny' ? 'Clear instructions, plus the occasional bad joke. You can change this any time in Settings.' : 'CLEAR INSTRUCTIONS. MAXIMUM VOLUME. Jokes are extras — the real advice always comes first.'}</p>
          </Coach>
          <button type="button" className="btn primary block" onClick={() => setStep('start')}>Continue</button>
        </>
      )}

      {step === 'start' && (
        <>
          <h1 id="welcome-h" className="t-title" tabIndex={-1}>How would you like to start?</h1>
          <button type="button" className="choice" onClick={() => { updateSettings({ hasGuitar: true }); setStep('mic'); }}>
            <Icon name="mic" />
            <div><div className="c-title">Let the app hear me play</div><div className="c-sub">Best: it tells you which note it heard.</div></div>
          </button>
          <button type="button" className="choice" onClick={() => { updateSettings({ hasGuitar: true, inputMode: 'none' }); setStep('output'); }}>
            <Icon name="guitar" />
            <div><div className="c-title">Start without the mic</div><div className="c-sub">You check yourself; nothing is scored.</div></div>
          </button>
          <button type="button" className="choice" onClick={() => { updateSettings({ hasGuitar: false, inputMode: 'simulation', onboarded: true }); navigate('learn', 'lesson.meet-guitar.v1'); }}>
            <Icon name="flask" />
            <div><div className="c-title">No guitar yet? Try the simulation</div><div className="c-sub">Pretend playing to see how it works. Never counts as progress.</div></div>
          </button>
          <button type="button" className="btn text" onClick={() => setStep('hello')}>Back</button>
        </>
      )}

      {step === 'mic' && (
        <>
          <h1 id="welcome-h" className="t-title" tabIndex={-1}>Let the app hear your guitar</h1>
          <p>Your browser will ask for the microphone. Sound is analysed on this device and thrown away — nothing is recorded or uploaded.</p>
          {mic === 'on' ? (
            <>
              <Callout kind="good" testId="mic-on">Listening. Pluck any string — the bar should move.</Callout>
              <InputMeter />
            </>
          ) : engine.micError ? (
            <Callout kind="bad">
              <strong role="alert">{engine.micError.title}</strong>
              <div className="t-small">{engine.micError.detail}</div>
            </Callout>
          ) : null}
          {mic !== 'on' && (
            <button type="button" className="btn primary block" onClick={startMic} disabled={busy || mic === 'requesting'}>
              {engine.micError ? 'Try again' : mic === 'requesting' ? 'Waiting for permission…' : 'Allow the microphone'}
            </button>
          )}
          {mic === 'on' && <button type="button" className="btn primary block" onClick={() => setStep('output')}>Sounds good — continue</button>}
          <button type="button" className="btn text" onClick={() => { engine.stopMic(); updateSettings({ inputMode: 'none' }); setStep('output'); }}>Start without the mic</button>
        </>
      )}

      {step === 'output' && (
        <>
          <h1 id="welcome-h" className="t-title" tabIndex={-1}>How will you hear the app?</h1>
          <div className="stack" role="radiogroup" aria-label="Output">
            <button type="button" role="radio" className="choice" aria-checked={settings.outputRoute === 'headphones'} onClick={() => updateSettings({ outputRoute: 'headphones' })}>
              <Icon name="headphones" />
              <div><div className="c-title">Headphones</div><div className="c-sub">Recommended: you hear the guide tune, the mic hears only your guitar. Wired is best for timing.</div></div>
            </button>
            <button type="button" role="radio" className="choice" aria-checked={settings.outputRoute === 'speakers'} onClick={() => updateSettings({ outputRoute: 'speakers' })}>
              <Icon name="speaker" />
              <div><div className="c-title">Speakers</div><div className="c-sub">Fine too. The guide tune goes quiet while the mic is listening.</div></div>
            </button>
          </div>
          <button type="button" className="btn primary block" onClick={() => setStep('done')} disabled={settings.outputRoute === 'unknown'}>Continue</button>
        </>
      )}

      {step === 'done' && (
        <>
          <h1 id="welcome-h" className="t-title" tabIndex={-1}>You're set.</h1>
          <p>First, a quick look at the guitar — then tune it and make your first sound. Lessons take about 5 minutes; stop whenever you like.</p>
          <button type="button" className="btn primary block" onClick={() => finish('lesson')}>Start lesson 1</button>
          <button type="button" className="btn tonal block" onClick={() => finish('tune')}>Tune my guitar first</button>
        </>
      )}
    </section>
    </div>
  );
}
