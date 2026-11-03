import { useEffect, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { LESSONS, attemptFeedback, findLesson, type Lesson, type LessonStep } from '../../learning/lessons';
import { findBundledScore } from '../../content/scores';
import type { Evidence } from '../../storage/types';
import { useApp } from '../AppContext';
import { navigate, PageHead, StatusChip } from '../App';
import { FretDiagram } from '../components/FretDiagram';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';
import { PracticePlayer } from '../practice/PracticePlayer';
import { EarComparePanel, QuizPanel, SequencePanel, StrumAlongPanel, TapPulsePanel } from '../components/StepPanels';
import { Icon } from '../icons';
import { toast, TopBar } from '../kit';
import { CHAPTERS, chapterOf as chapterOfLesson, isBossFight, METAL_CHAPTER_ID } from '../../learning/chapters';
import { Coach, RankBadge, StrumPattern, TIER_INFO, VenueArt } from '../art';
import { completedLessonIds, rankProgress, useJoke } from '../coach';

const TECHNIQUE_LABEL: Record<string, string> = { bend: 'Bend', slide: 'Slide', hammer_on: 'Hammer-on', pull_off: 'Pull-off', vibrato: 'Vibrato', palm_mute: 'Palm mute', double_stop: 'Double stop', octaves: 'Octaves', thumb_over: 'Thumb over' };

function techniqueText(t: NonNullable<LessonStep['technique']>): string {
  const on = t.string ? `string ${t.string}` : t.strings ? `strings ${t.strings.join(' + ')}` : '';
  if (t.kind === 'bend') return `${on}: fret ${t.fromFret ?? '?'} → push up ${t.semitones === 1 ? 'a half step' : 'a whole step'}${t.toFret ? ` (to the pitch of fret ${t.toFret})` : ''}`;
  if (t.kind === 'slide' || t.kind === 'hammer_on' || t.kind === 'pull_off') return `${on}: fret ${t.fromFret ?? 0} → fret ${t.toFret ?? '?'}`;
  return on;
}

function evidenceBadge(e: Evidence | null | undefined) {
  if (e === 'sensor') return <span className="badge good"><Icon name="mic" size={12} /> Heard</span>;
  if (e === 'simulated') return <span className="badge sim">Simulation</span>;
  if (e === 'self_reported') return <span className="badge">Self-check</span>;
  return null;
}

/** The journey map: chapters are venues from the bedroom to the stadium. */
export function Learn({ lessonId }: { lessonId: string | null }) {
  const { lessons } = useApp();
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  const done = completedLessonIds(lessons);
  const current = LESSONS.find((l) => !lessons[l.lessonId]?.completedAt);
  const currentChapter = current ? CHAPTERS.find((c) => c.ids.includes(current.lessonId)) : null;
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentChapter ? [currentChapter.id] : [CHAPTERS[0]?.id ?? '']));
  const rank = rankProgress(done);
  if (lesson) return <LessonRunner key={lesson.lessonId} lesson={lesson} />;
  let n = 0;
  return (
    <section aria-labelledby="learn-h">
      <PageHead title="Learn" />
      <div className="card rank-card" style={{ marginBottom: 8 }}>
        <RankBadge level={rank.level} max={rank.max} size={52} />
        <div className="spacer">
          <div className="rank-title">{rank.title}</div>
          <div className="t-small muted">{done.size} of {LESSONS.length} lessons · {rank.nextTitle ? `next rank: ${rank.nextTitle}` : 'top rank reached'}</div>
          <div className="xp" style={{ marginTop: 6 }}><i style={{ width: `${Math.round((done.size / Math.max(1, LESSONS.length)) * 100)}%` }} /></div>
        </div>
      </div>
      {CHAPTERS.map((c) => {
        const lessonsIn = c.ids.map((id) => findLesson(id)).filter((l): l is Lesson => !!l);
        const doneIn = lessonsIn.filter((l) => done.has(l.lessonId)).length;
        const isOpen = open.has(c.id);
        const first = n;
        n += lessonsIn.length;
        return (
          <div key={c.id}>
            <button type="button" className="venue" style={{ width: '100%', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }} aria-expanded={isOpen}
              onClick={() => setOpen((o) => { const x = new Set(o); if (x.has(c.id)) x.delete(c.id); else x.add(c.id); return x; })}>
              <VenueArt tier={c.tier} />
              <span className="v-body">
                <span>
                  <span className="v-kicker" style={{ display: 'block' }}>{TIER_INFO[c.tier].venue}</span>
                  <span className="t-title" style={{ display: 'block', color: '#fff', fontSize: 30, lineHeight: '32px', margin: '2px 0' }}><span aria-hidden="true">{c.emoji} </span>{c.title}</span>
                  <span className="v-sub" style={{ display: 'block' }}>{c.subtitle}</span>
                </span>
                <span className="v-count num" aria-label={`${doneIn} of ${lessonsIn.length} done`}>{doneIn}/{lessonsIn.length}</span>
              </span>
            </button>
            {isOpen && (
              <div className="trail">
                {lessonsIn.map((l, i) => {
                  const p = lessons[l.lessonId];
                  const isDone = done.has(l.lessonId);
                  const isCurrent = current?.lessonId === l.lessonId;
                  const boss = isBossFight(l.lessonId);
                  return (
                    <a key={l.lessonId} href={`#/learn/${l.lessonId}`} className={`pathnode${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}${boss ? ' boss' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
                      <span className="dot">{isDone ? <Icon name="check" /> : boss ? '★' : first + i + 1}</span>
                      <span className="spacer">
                        <span className="lr-title" style={{ display: 'block', fontWeight: 700 }}>{l.title}</span>
                        <span className="t-small muted" style={{ display: 'block' }}>
                          {isDone ? (p?.skillState === 'retained' ? 'Remembered on a later day' : 'Done') : p ? `${p.completedSteps.length} of ${l.steps.length} steps` : `About ${l.estimatedMinutes.replace(/ \(.*\)/, '')} min`}
                        </span>
                      </span>
                      {isDone && evidenceBadge(p?.completionEvidence)}
                      {p?.skillState === 'retained' && <span className="badge good">Retained</span>}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <p className="t-caption" style={{ marginTop: 24 }}>Lessons are drafts written for this app and have not yet been reviewed by a guitar teacher. If anything hurts, stop and rest.</p>
    </section>
  );
}

function LessonRunner({ lesson }: { lesson: Lesson }) {
  const { lessons, settings, recordStep, completeLesson, updateSettings } = useApp();
  const startJoke = useJoke(isBossFight(lesson.lessonId) ? 'boss_fight' : chapterOfLesson(lesson.lessonId)?.id === METAL_CHAPTER_ID ? 'metal_unlocked' : 'lesson_start', lesson.title.length);
  const endJoke = useJoke(lesson.nextLessonId ? 'lesson_complete' : 'chapter_complete', lesson.lessonId.length);
  const progress = lessons[lesson.lessonId];
  const done = new Set(progress?.completedSteps.map((s) => s.stepId) ?? []);
  const firstOpen = lesson.steps.findIndex((s) => !done.has(s.id));
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const step = lesson.steps[idx]!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const evidenceSource: Evidence = settings.inputMode === 'simulation' ? 'simulated' : 'sensor';

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo?.(0, 0);
  }, [idx]);

  const finishStep = (evidence: Evidence) => {
    const already = done.has(step.id);
    recordStep(lesson.lessonId, step.id, evidence);
    if (!already) toast(evidence === 'simulated' ? 'Step saved (simulation only)' : evidence === 'self_reported' ? 'Step saved (self-check)' : 'Step saved');
  };
  const next = () => setIdx((i) => Math.min(lesson.steps.length - 1, i + 1));
  const stepEvidence = progress?.completedSteps.find((s) => s.stepId === step.id)?.evidence;

  return (
    <section aria-labelledby="lesson-h" className="lesson-body">
      <TopBar title={lesson.title} back={() => navigate('learn')}>
        <StatusChip />
      </TopBar>
      <div className="steps-bar" role="img" aria-label={`Step ${idx + 1} of ${lesson.steps.length}`} style={{ marginBottom: 16 }}>
        {lesson.steps.map((s, i) => <i key={s.id} className={i === idx ? 'current' : done.has(s.id) ? 'done' : ''} />)}
      </div>
      <p className="t-caption" style={{ marginBottom: 4 }}>Step {idx + 1} of {lesson.steps.length}</p>
      <h2 id="lesson-h" className="t-title" ref={headingRef} tabIndex={-1} style={{ marginBottom: 12 }}>{step.title}</h2>
      <div className="stack">
        {step.tuning === 'drop-d' && (
          <div className="row"><a className="chip on" href="#/tune" onClick={() => updateSettings({ tuning: 'drop_d' })}><Icon name="tune" size={16} /> Drop D — open the tuner</a></div>
        )}
        <div>{step.body.map((p, i) => <p key={i}>{p}</p>)}</div>
        {step.funny && settings.voice !== 'plain' && idx !== 0 && <p className="joke-aside">{step.funny}</p>}
        {step.technique && (
          <div className="card tight row nowrap" style={{ gap: 12 }} data-testid="technique">
            <span className="badge" style={{ fontSize: 13 }}>{TECHNIQUE_LABEL[step.technique.kind] ?? step.technique.kind}</span>
            <span className="spacer t-small">{techniqueText(step.technique)}</span>
            <span className="t-caption">Not checked — use your ears</span>
          </div>
        )}
        {step.tab && (
          <figure className="tabblock" style={{ margin: 0 }}>
            <pre aria-label={`Tab: ${step.tab.join(' / ')}`}>{step.tab.join('\n')}</pre>
            <figcaption className="t-caption">Tab: string 1 (high e) on top; numbers are frets.</figcaption>
          </figure>
        )}
        {step.strum?.pattern && <div className="stack" style={{ gap: 4 }}><span className="t-small muted" style={{ fontWeight: 700 }}>Strum pattern{step.strum.feel === 'shuffle' ? ' · shuffle feel' : ''}</span><StrumPattern pattern={step.strum.pattern} /></div>}
        {step.diagram && step.kind !== 'strum-along' && <div className="card tight"><FretDiagram diagram={step.diagram} leftHanded={settings.handedness === 'left'} /></div>}
        {step.phases && (
          <ol className="phases" aria-label="Movement phases">
            {step.phases.map((ph) => <li key={ph.label}><strong>{ph.label}</strong>{ph.text}</li>)}
          </ol>
        )}
        {idx === 0 && <Coach mood={isBossFight(lesson.lessonId) ? 'rock' : 'happy'} joke={startJoke}><p>{lesson.learningObjective}</p></Coach>}
        {step.demoMidis && <DemoButton midis={step.demoMidis} label={step.demoLabel ?? 'Hear it'} />}

        {step.kind === 'attempt' && step.attempt && <AttemptPanel step={step} onComplete={finishStep} evidenceSource={evidenceSource} />}
        {step.kind === 'stop-ringing' && <StopRingingPanel step={step} onComplete={finishStep} evidenceSource={evidenceSource} />}
        {step.kind === 'practice' && step.scoreRef && (
          <div>
            <PracticePlayer
              key={`${lesson.lessonId}:${step.id}`}
              score={findBundledScore(step.scoreRef)!}
              compact
              initial={step.practice}
              onSummary={(r) => {
                if (r.stats.pitch.accuracy !== null && r.stats.pitch.accuracy >= 0.6) finishStep(r.simulated ? 'simulated' : 'sensor');
              }}
            />
            {step.selfCheckLabel && <button type="button" className="btn outline block" onClick={() => finishStep('self_reported')} style={{ marginTop: 12 }}>{step.selfCheckLabel}</button>}
          </div>
        )}
        {step.kind === 'quiz' && step.quiz && <QuizPanel key={step.id} quiz={step.quiz} onComplete={() => finishStep('sensor')} />}
        {step.kind === 'tap-pulse' && step.pulse && <TapPulsePanel key={step.id} bpm={step.pulse.bpm} beats={step.pulse.beats} onComplete={() => finishStep('sensor')} />}
        {step.kind === 'sequence' && step.sequence && <SequencePanel key={step.id} step={step} onComplete={finishStep} evidenceSource={evidenceSource} />}
        {step.kind === 'strum-along' && step.strum && <StrumAlongPanel key={step.id} strum={step.strum} leftHanded={settings.handedness === 'left'} />}
        {step.kind === 'ear-compare' && step.ear && <EarComparePanel key={step.id} ear={step.ear} onComplete={() => finishStep('sensor')} />}
        {step.selfCheckLabel && (step.kind === 'tap-pulse' || step.kind === 'strum-along') && (
          <button type="button" className="btn outline block" onClick={() => finishStep('self_reported')}>{step.selfCheckLabel}</button>
        )}
        {step.kind === 'choice' && (
          <div className="stack">
            {lesson.nextLessonId && (
              <button type="button" className="btn primary block" onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('learn', lesson.nextLessonId!); }}>
                Next: {findLesson(lesson.nextLessonId)?.title ?? 'next lesson'}
              </button>
            )}
            <Coach mood="rock" joke={endJoke}><p>{lesson.nextLessonId ? 'Lesson done. Short rests help it stick.' : 'That was the last lesson on the path. Now take a song you love through Easy, Medium and Full.'}</p></Coach>
            {!lesson.nextLessonId && (
              <button type="button" className="btn primary block" onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('practice'); }}>Play your songs</button>
            )}
            <button type="button" className="btn tonal block" onClick={() => setIdx(0)}>Repeat this lesson</button>
            <button type="button" className="btn outline block" onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('today'); }}>Finish for today</button>
          </div>
        )}
        {done.has(step.id) && step.kind !== 'choice' && (
          <div className="callout good" data-testid="step-saved">
            <Icon name="check" size={20} />
            <div>Step saved{stepEvidence === 'simulated' ? ' (simulation only — not real assessment)' : stepEvidence === 'self_reported' ? ' (self-check)' : ''}.</div>
          </div>
        )}
      </div>
      {step.kind !== 'choice' && (
        <div className="actionbar">
          <button type="button" className="btn outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Back</button>
          {step.kind === 'info' || step.kind === 'demo' ? (
            <button type="button" className="btn primary" onClick={() => { finishStep('self_reported'); next(); }}>Got it — next</button>
          ) : (
            <button type="button" className={`btn ${done.has(step.id) ? 'primary' : 'tonal'}`} onClick={next}>{done.has(step.id) ? 'Next step' : 'Skip for now'}</button>
          )}
        </div>
      )}
    </section>
  );

  function bestEvidence(): Evidence {
    // Sensor evidence only if every listening step was actually heard; any simulated
    // step keeps the lesson labeled simulated; otherwise it is a self-report.
    const attemptIds = lesson.steps.filter((s) => s.kind === 'attempt' || s.kind === 'sequence').map((s) => s.id);
    const attemptEvs = progress?.completedSteps.filter((s) => attemptIds.includes(s.stepId)).map((s) => s.evidence) ?? [];
    if (attemptEvs.length === attemptIds.length && attemptEvs.every((e) => e === 'sensor')) return 'sensor';
    if (progress?.completedSteps.some((s) => s.evidence === 'simulated')) return 'simulated';
    return 'self_reported';
  }
}

function DemoButton({ midis, label }: { midis: number[]; label: string }) {
  const [playing, setPlaying] = useState(false);
  const h = useRef<Handle | null>(null);
  useEffect(() => () => h.current?.stop(), []);
  return (
    <div className="row">
      <button type="button" className="btn tonal" data-testid="demo" onClick={async () => {
        h.current?.stop();
        const d = await engine.demonstrate(midis, 0.9, 'reference');
        h.current = d.handle;
        setPlaying(true);
        window.setTimeout(() => setPlaying(false), (d.end - d.start) * 1000);
      }} disabled={playing}><Icon name="volume" size={20} />{playing ? 'Playing… (mic paused)' : label}</button>
      {playing && <button type="button" className="btn outline" onClick={() => { h.current?.stop(); setPlaying(false); }}>Stop</button>}
    </div>
  );
}

function AttemptPanel({ step, onComplete, evidenceSource }: { step: LessonStep; onComplete: (e: Evidence) => void; evidenceSource: Evidence }) {
  const { settings, mic } = useApp();
  const spec = step.attempt!;
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const [msg, setMsg] = useState<string | null>(null);
  const lastEvent = useRef(performance.now());
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const sim = settings.inputMode === 'simulation';
  const listening = sim || mic === 'on';

  useEffect(() => {
    countRef.current = 0;
    setCount(0);
    setMsg(null);
  }, [step.id]);

  useEffect(() => {
    if (!listening) return;
    lastEvent.current = performance.now();
    const off = engine.on('attack', (a) => {
      if (a.simulated !== sim) return;
      lastEvent.current = performance.now();
      if (a.quality !== 'good' || a.pitchMidiFloat === null) {
        setMsg(a.reasonCodes.includes('clipping') ? 'That was too loud for the microphone (clipping). Pluck a little softer or move the mic back.' : 'I heard a sound but not one clear note. If it sounded dull or buzzy to you, move your fingertip closer to the fret and check no other finger touches the string.');
        return;
      }
      const fb = attemptFeedback(spec, a.pitchMidiFloat);
      const prefix = sim ? 'Simulated: ' : '';
      if (!fb.correct) {
        setMsg(`${prefix}${fb.text}`);
        return;
      }
      countRef.current += 1;
      const n = countRef.current;
      setCount(n);
      setMsg(`${prefix}${fb.text} ${n >= spec.required ? 'That’s it — step complete.' : 'Try it once more.'}`);
      if (n === spec.required) completeRef.current(evidenceSource);
    });
    const silence = window.setInterval(() => {
      if (performance.now() - lastEvent.current > 9000) {
        lastEvent.current = performance.now();
        setMsg("I couldn't hear a clear note. Check the input meter and pluck once.");
      }
    }, 1000);
    return () => {
      off();
      window.clearInterval(silence);
    };
  }, [listening, sim, spec, evidenceSource]);

  return (
    <div className="stack">
      {!sim && <ListenControl purpose="hear your note and tell you what I heard" />}
      {mic === 'on' && <InputMeter compact />}
      <p className="t-small">Target: <strong>{spec.fret === 0 ? `open string ${spec.string}` : `string ${spec.string}, fret ${spec.fret}`}</strong>. Heard correctly: {Math.min(count, spec.required)} of {spec.required}.</p>
      <p role="status" aria-live="polite" className="feedback-line" data-testid="lesson-feedback">{msg ?? (listening ? 'Listening… take your time.' : 'Listening is off — use the self-check when you have played it.')}</p>
      {sim && (
        <div className="sim-tray" aria-label="Simulation controls">
          <button type="button" className="btn sim" onClick={() => engine.simulateAttack(spec.targetMidi)} data-testid="sim-correct">Pretend: right note</button>
          <button type="button" className="btn sim" onClick={() => engine.simulateAttack(spec.targetMidi + (spec.fret > 0 ? -spec.fret : 1))}>Pretend: wrong note</button>
        </div>
      )}
      {step.selfCheckLabel && <button type="button" className="btn outline block" onClick={() => onComplete('self_reported')}>{step.selfCheckLabel}</button>}
    </div>
  );
}

function StopRingingPanel({ step, onComplete, evidenceSource }: { step: LessonStep; onComplete: (e: Evidence) => void; evidenceSource: Evidence }) {
  const { settings, mic } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const sim = settings.inputMode === 'simulation';
  useEffect(() => {
    if (mic !== 'on' || sim) return;
    let ringingSince: number | null = null;
    let quietSince: number | null = null;
    let done = false;
    const offA = engine.on('attack', (a) => {
      if (a.quality === 'good' && !done) {
        ringingSince = a.onsetContextSec;
        quietSince = null;
        setMsg('I hear it ringing. Now stop it gently.');
      }
    });
    const offF = engine.on('frame', (f) => {
      if (ringingSince === null || done) return;
      const quiet = f.reasonCodes.includes('below_gate');
      if (quiet) {
        quietSince ??= f.centerSec;
        if (f.centerSec - quietSince > 0.25) {
          done = true;
          const ringFor = quietSince - ringingSince;
          setMsg(`I heard the sound stop${ringFor < 4 ? '' : ' (it may also have faded naturally)'}. Nice.`);
          completeRef.current(evidenceSource);
        }
      } else quietSince = null;
    });
    return () => {
      offA();
      offF();
    };
  }, [mic, sim, evidenceSource]);
  return (
    <div className="stack">
      {!sim && <ListenControl purpose="hear when the sound stops" />}
      <p role="status" aria-live="polite" className="feedback-line">{msg ?? (sim ? 'Simulation cannot check this step — use the self-check.' : mic === 'on' ? 'Pluck string 1, let it ring, then stop it.' : 'Use the self-check when you have stopped the sound.')}</p>
      {step.selfCheckLabel && <button type="button" className="btn outline block" onClick={() => onComplete('self_reported')}>{step.selfCheckLabel}</button>}
    </div>
  );
}
