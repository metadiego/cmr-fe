// Nursing-panel alarm engine (lib/panel/nursing-alarm.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { createNursingAlarm, ALARM_PEAK_GAIN, type AlarmAudioContext } from "./nursing-alarm.ts";

type Node = { kind: string; connected: unknown[]; gainSteps: number[]; started: number; stopped: number; frequency: { value: number }; type: string };

function fakeContext(initial: "running" | "suspended") {
  const nodes: Node[] = [];
  const make = (kind: string): Node => {
    const n: Node = {
      kind, connected: [], gainSteps: [], started: 0, stopped: 0, frequency: { value: 0 }, type: "",
    };
    nodes.push(n);
    return n;
  };
  const ctx = {
    state: initial as string,
    currentTime: 0,
    resumed: 0,
    destination: { kind: "destination" },
    resume() { ctx.resumed++; ctx.state = "running"; return Promise.resolve(); },
    createOscillator() {
      const n = make("osc");
      return Object.assign(n, {
        connect: (to: unknown) => { n.connected.push(to); return to; },
        start: () => { n.started++; },
        stop: () => { n.stopped++; },
      });
    },
    createGain() {
      const n = make("gain");
      const gain = {
        setValueAtTime: (v: number) => { n.gainSteps.push(v); },
        exponentialRampToValueAtTime: (v: number) => { n.gainSteps.push(v); },
        linearRampToValueAtTime: (v: number) => { n.gainSteps.push(v); },
      };
      return Object.assign(n, { gain, connect: (to: unknown) => { n.connected.push(to); return to; } });
    },
    createDynamicsCompressor() {
      const n = make("compressor");
      const p = () => ({ value: 0 });
      return Object.assign(n, {
        threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(),
        connect: (to: unknown) => { n.connected.push(to); return to; },
      });
    },
  };
  return { ctx, nodes };
}

function fakeTimers() {
  const fns: (() => void)[] = [];
  return {
    fns,
    setInterval: (fn: () => void) => { fns.push(fn); return fns.length; },
    clearInterval: (id: number) => { fns[id - 1] = () => {}; },
  };
}

test("the alarm is enabled by default: the audio context exists without pressing any button", () => {
  const { ctx } = fakeContext("running");
  let created = 0;
  const alarm = createNursingAlarm({ createContext: () => { created++; return ctx as unknown as AlarmAudioContext; }, timers: fakeTimers() });
  assert.equal(created, 1);
  assert.equal(alarm.needsGesture(), false);
});

test("a context the browser starts suspended is resumed by the first gesture anywhere", async () => {
  const { ctx } = fakeContext("suspended");
  const alarm = createNursingAlarm({ createContext: () => ctx as unknown as AlarmAudioContext, timers: fakeTimers() });
  assert.equal(alarm.needsGesture(), true);
  await alarm.unlock();
  assert.equal(ctx.resumed, 1);
  assert.equal(alarm.needsGesture(), false);
});

test("a pending notice rings even if the context was unlocked AFTER it arrived", async () => {
  const { ctx, nodes } = fakeContext("suspended");
  const timers = fakeTimers();
  const alarm = createNursingAlarm({ createContext: () => ctx as unknown as AlarmAudioContext, timers });
  alarm.start({ hz: 880, tipo: "sine" });
  await alarm.unlock();
  assert.ok(nodes.some((n) => n.kind === "osc" && n.started > 0), "it beeps once unlocked");
  assert.equal(timers.fns.length, 1, "and keeps looping");
});

test("each beep is loud: peak gain near full scale, through a compressor that prevents clipping", () => {
  const { ctx, nodes } = fakeContext("running");
  const alarm = createNursingAlarm({ createContext: () => ctx as unknown as AlarmAudioContext, timers: fakeTimers() });
  alarm.start({ hz: 587, tipo: "triangle" });
  assert.ok(ALARM_PEAK_GAIN >= 0.8, `peak gain ${ALARM_PEAK_GAIN} must be >= 0.8 (it was 0.25)`);
  const peaks = nodes.filter((n) => n.kind === "gain").map((n) => Math.max(...n.gainSteps));
  assert.ok(peaks.some((p) => p >= ALARM_PEAK_GAIN), "a gain stage reaches the peak");
  const compressor = nodes.find((n) => n.kind === "compressor");
  assert.ok(compressor, "a compressor sits before the speakers");
  assert.ok(compressor!.connected.includes(ctx.destination));
  const osc = nodes.find((n) => n.kind === "osc")!;
  assert.equal(osc.frequency.value, 587);
  assert.equal(osc.type, "triangle");
});

test("stop ends the loop; a later start loops again", () => {
  const { ctx } = fakeContext("running");
  const timers = fakeTimers();
  const alarm = createNursingAlarm({ createContext: () => ctx as unknown as AlarmAudioContext, timers });
  alarm.start({ hz: 880, tipo: "sine" });
  alarm.start({ hz: 880, tipo: "sine" });
  assert.equal(timers.fns.length, 1, "a second start does not stack loops");
  alarm.stop();
  alarm.start({ hz: 880, tipo: "sine" });
  assert.equal(timers.fns.length, 2);
});

test("without Web Audio (old browser) nothing throws", () => {
  const alarm = createNursingAlarm({ createContext: () => { throw new Error("no audio"); }, timers: fakeTimers() });
  assert.doesNotThrow(() => alarm.start({ hz: 880, tipo: "sine" }));
  assert.equal(alarm.needsGesture(), false);
});
