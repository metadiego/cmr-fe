// Nursing-panel alarm: a looping beep made with Web Audio (no audio files).
//
// Enabled by default: the audio context is created as soon as the panel mounts. Browsers may start
// it "suspended" until someone touches the page (autoplay policy); `unlock()` resumes it and the
// panel calls it on the FIRST gesture anywhere, so nobody has to find an "enable sound" button.
// A notice that arrived while suspended starts ringing the moment the context is unlocked.
//
// Loud: the old beep peaked at 0.25 of full scale with a bare sine. Now each beep layers the
// fundamental with its octave (more presence on small tablet speakers), peaks near full scale, and
// goes through a compressor so the sum never clips.

export type AlarmTone = { hz: number; tipo: OscillatorType };

/** Peak gain of each beep (0..1 of full scale). Was 0.25. */
export const ALARM_PEAK_GAIN = 0.95;
const OCTAVE_GAIN = 0.5; // relative level of the octave layered on top of the fundamental
const BEEP_SECONDS = 0.55;
const LOOP_MS = 1000;

/** The subset of AudioContext the alarm uses (so tests can pass a fake). */
export type AlarmAudioContext = Pick<
  AudioContext,
  "state" | "currentTime" | "destination" | "resume" | "createOscillator" | "createGain" | "createDynamicsCompressor"
>;

type Timers = {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: never) => void;
};

export type NursingAlarm = {
  /** True while the browser keeps the sound blocked until a user gesture. */
  needsGesture: () => boolean;
  /** Resume a suspended context (call from a user gesture). Starts a pending alarm. */
  unlock: () => Promise<void>;
  /** Ring in a loop with this tone; a running loop just switches tone. */
  start: (tone: AlarmTone) => void;
  stop: () => void;
};

export function createNursingAlarm(deps: { createContext: () => AlarmAudioContext; timers?: Timers }): NursingAlarm {
  const timers: Timers = deps.timers ?? {
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) => globalThis.clearInterval(id),
  };
  let ctx: AlarmAudioContext | null = null;
  try { ctx = deps.createContext(); } catch { ctx = null; }

  let output: AudioNode | null = null;
  const out = (c: AlarmAudioContext): AudioNode => {
    if (output) return output;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.1;
    comp.connect(c.destination);
    output = comp;
    return comp;
  };

  let tone: AlarmTone | null = null;
  let timer: unknown = null;
  let wanted = false; // a notice is pending (start called and not stopped)

  const running = () => !!ctx && ctx.state === "running";

  const beep = () => {
    const c = ctx;
    if (!c || c.state !== "running" || !tone) return;
    const t0 = c.currentTime;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(ALARM_PEAK_GAIN, t0 + 0.015);
    env.gain.setValueAtTime(ALARM_PEAK_GAIN, t0 + BEEP_SECONDS * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + BEEP_SECONDS);
    env.connect(out(c));

    const layer = (hz: number, level: number) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      o.type = tone!.tipo;
      if (level >= 1) {
        o.connect(env);
      } else {
        const g = c.createGain();
        g.gain.setValueAtTime(level, t0);
        o.connect(g);
        g.connect(env);
      }
      o.start(t0);
      o.stop(t0 + BEEP_SECONDS + 0.02);
    };
    layer(tone.hz, 1);
    layer(tone.hz * 2, OCTAVE_GAIN);
  };

  const loop = () => {
    if (timer || !running()) return;
    beep();
    timer = timers.setInterval(beep, LOOP_MS);
  };

  return {
    needsGesture: () => !!ctx && ctx.state !== "running",
    unlock: async () => {
      if (!ctx || ctx.state === "running") return;
      try { await ctx.resume(); } catch { /* still blocked: the next gesture retries */ }
      if (wanted) loop();
    },
    start: (next) => {
      tone = next;
      wanted = true;
      loop();
    },
    stop: () => {
      wanted = false;
      if (timer) { timers.clearInterval(timer as never); timer = null; }
    },
  };
}
