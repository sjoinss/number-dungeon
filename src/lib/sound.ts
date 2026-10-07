/**
 * 8비트 효과음 (Web Audio, 파일 없음). 점프점프처럼 첫 입력 뒤에만 소리가 난다(브라우저 정책).
 */

export type Sfx = "move" | "win" | "lose" | "clear" | "chest" | "undo" | "blocked" | "item" | "trap";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = [freq: number, start: number, dur: number];

const SONGS: Record<Sfx, { wave: OscillatorType; notes: Note[]; gain: number }> = {
  move: { wave: "square", notes: [[440, 0, 0.05]], gain: 0.05 },
  win: { wave: "square", notes: [[523, 0, 0.07], [784, 0.07, 0.1]], gain: 0.07 },
  item: { wave: "triangle", notes: [[660, 0, 0.07], [880, 0.07, 0.1]], gain: 0.1 },
  chest: { wave: "triangle", notes: [[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.14]], gain: 0.1 },
  trap: { wave: "sawtooth", notes: [[300, 0, 0.08], [200, 0.08, 0.12]], gain: 0.05 },
  lose: { wave: "sawtooth", notes: [[330, 0, 0.12], [247, 0.12, 0.12], [165, 0.24, 0.25]], gain: 0.06 },
  clear: { wave: "square", notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.3]], gain: 0.07 },
  undo: { wave: "triangle", notes: [[600, 0, 0.05], [450, 0.05, 0.07]], gain: 0.08 },
  blocked: { wave: "square", notes: [[180, 0, 0.12]], gain: 0.05 },
};

export function playSfx(kind: Sfx) {
  const ac = audio();
  if (!ac) return;
  const song = SONGS[kind];
  const t0 = ac.currentTime + 0.01;
  for (const [freq, start, dur] of song.notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = song.wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(song.gain, t0 + start);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.02);
  }
}
