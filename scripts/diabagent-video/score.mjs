/**
 * The soundtrack of "One day": a felted piano over a slow pad, plus small device
 * sounds, all synthesised here from sine waves and noise, with no samples. The music
 * runs on a 4.4 s bar in D major so its chords turn when the story does, and every
 * effect lands on a cue from scene.js. Seeded, so it renders the same each time.
 */
import fs from "node:fs";

export const SR = 48000;
const TAU = Math.PI * 2;
const BAR = 4.4;
const STEP = BAR / 8;

const MUSIC_GAIN = 0.56;
const EFFECTS_GAIN = 0.62;
const PEAK_LIMIT = 0.89;

const CHORDS = {
  D: { bass: 38, pad: [50, 57, 64, 66, 69], arp: [62, 69, 74, 76, 78, 76, 74, 69] },
  "A/C#": { bass: 37, pad: [49, 57, 64, 69, 73], arp: [57, 64, 69, 73, 76, 73, 69, 64] },
  Bm7: { bass: 35, pad: [47, 54, 62, 66, 69], arp: [59, 66, 69, 74, 78, 74, 69, 66] },
  G: { bass: 31, pad: [43, 50, 59, 66, 69], arp: [55, 62, 66, 71, 74, 71, 66, 62] },
  Em9: { bass: 40, pad: [52, 59, 62, 66, 71], arp: [59, 62, 67, 71, 78, 71, 67, 62] },
  Asus: { bass: 33, pad: [45, 57, 62, 64, 69], arp: [57, 64, 69, 74, 76, 74, 69, 64] },
  A: { bass: 33, pad: [45, 57, 61, 64, 69], arp: [57, 64, 69, 73, 76, 73, 69, 64] },
};

// [start in bars, chord, texture]. "still" leaves room for the title and the recap,
// "pulse" adds a low heartbeat while something is going wrong.
const SECTIONS = [
  [0, "D", "still"], // Title
  [1, "Bm7", "sparse"], // The hidden world
  [2, "G", "sparse"],
  [3, "D", "flow"], // First decision
  [4, "A/C#", "flow"],
  [5, "Bm7", "pulse"], // Exercise
  [6, "G", "pulse"],
  [6.5, "Asus", "pulse"],
  [7, "D", "sparse"], // Back in range
  [8, "G", "sparse"],
  [9, "Em9", "pulse"], // Dinner nobody announced
  [10, "Asus", "pulse"],
  [10.5, "A", "pulse"],
  [11, "G", "flow"], // Insulin still acting
  [12, "D", "sparse"], // Back in range
  [13, "Bm7", "still"], // What really happened
  [14, "G", "sparse"],
  [15, "Em9", "still"], // The score
  [15.375, "Asus", "still"],
];
const FINAL_PAD = [38, 50, 57, 64, 66, 69, 74];

// How open the pad is over time, in Hz: darker when calm, brightest at the two scares.
const BRIGHTNESS = [
  [0, 500], [4.4, 700], [13.2, 950], [22, 1200], [30, 1900], [31.5, 1100], [39.6, 1300],
  [46.2, 2300], [50, 1500], [53, 1300], [57.2, 800], [64.2, 950], [69.4, 2000], [73, 900],
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hz = (note) => 440 * 2 ** ((note - 69) / 12);
const bus = (size) => ({ L: new Float32Array(size), R: new Float32Array(size) });

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function panGains(pan) {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function curve(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    if (t <= points[i][0]) {
      const [a, va] = points[i - 1];
      const [b, vb] = points[i];
      return va + (vb - va) * ((t - a) / (b - a));
    }
  }
  return points[points.length - 1][1];
}

// Voices ----------------------------------------------------------------------

/** Decaying sine partials, each [frequency, amplitude, time constant]. */
function modal(out, time, partials, { attack = 0.004, pan = 0, gain = 1 } = {}) {
  const [left, right] = panGains(pan);
  const start = Math.max(0, Math.round(time * SR));
  const ramp = Math.max(1, Math.round(attack * SR));
  for (const [f, a, tau] of partials) {
    if (f >= SR * 0.45) continue;
    const length = Math.min(Math.round(tau * 7 * SR), out.L.length - start);
    const w = (TAU * f) / SR;
    const decay = Math.exp(-1 / (tau * SR));
    let amp = a * gain;
    for (let i = 0; i < length; i += 1) {
      const rise = i < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * i) / ramp) : 1;
      const v = Math.sin(w * i) * amp * rise;
      out.L[start + i] += v * left;
      out.R[start + i] += v * right;
      amp *= decay;
    }
  }
}

function felt(out, time, note, velocity, pan = (note - 69) / 60) {
  const f0 = hz(note);
  const tau = clamp(3.2 * (220 / f0) ** 0.45, 1, 5.5);
  const tilt = 2.6 - 1.2 * velocity;
  const partials = [];
  for (let k = 1; k <= 8; k += 1) {
    const f = k * f0 * Math.sqrt(1 + 0.00035 * k * k);
    const a = velocity ** 1.3 / k ** tilt;
    const t = tau / (1 + 0.8 * (k - 1));
    // Two strings slightly apart: they beat, and one dies first, which is the piano's two-stage decay.
    partials.push([f * 0.99975, a * 0.6, t * 0.4], [f * 1.00025, a * 0.4, t]);
  }
  modal(out, time, partials, { attack: 0.014 - 0.01 * velocity, pan });
}

function mallet(out, time, note, gain, pan = 0) {
  const f = hz(note);
  modal(out, time, [[f, 1, 0.3], [f * 3.93, 0.2, 0.07], [f * 9.2, 0.05, 0.02]], { attack: 0.002, gain, pan });
}

function bell(out, time, note, gain, pan = 0) {
  const f = hz(note);
  modal(out, time, [[f, 1, 0.75], [f * 2.76, 0.22, 0.32], [f * 5.4, 0.07, 0.12]], { attack: 0.0015, gain, pan });
}

function kalimba(out, time, note, gain, pan = 0) {
  const f = hz(note);
  modal(out, time, [[f, 1, 0.5], [f * 2, 0.14, 0.2], [f * 6.1, 0.1, 0.035]], { attack: 0.0015, gain, pan });
}

/** The small mechanical step of a pump motor. */
function tick(out, time, gain, pan = 0) {
  modal(out, time, [[640, 0.7, 0.006], [1850, 0.7, 0.004], [3100, 0.5, 0.003]], { attack: 0.0004, gain, pan });
}

function bass(out, time, note, gain) {
  const f = hz(note);
  modal(out, time, [[f, 1, 2.2], [f * 2, 0.34, 1.5], [f * 3, 0.14, 0.9]], { attack: 0.35, gain });
}

/** Band-passed noise whose centre glides from one frequency to another. */
function whoosh(out, time, seconds, fromHz, toHz, gain, rand, panFrom = 0, panTo = panFrom) {
  const start = Math.max(0, Math.round(time * SR));
  const length = Math.min(Math.round(seconds * SR), out.L.length - start);
  let low = 0;
  let band = 0;
  for (let i = 0; i < length; i += 1) {
    const p = i / length;
    const g = 2 * Math.sin((Math.PI * fromHz * (toHz / fromHz) ** p) / SR);
    const high = rand() * 2 - 1 - low - 0.8 * band;
    band += g * high;
    low += g * band;
    const v = band * Math.sin(Math.PI * p ** 0.7) ** 2 * gain;
    const [left, right] = panGains(panFrom + (panTo - panFrom) * p);
    out.L[start + i] += v * left;
    out.R[start + i] += v * right;
  }
}

const WAVE_SIZE = 4096;
const WAVE = (() => {
  const table = new Float32Array(WAVE_SIZE + 1);
  for (let n = 1; n <= 12; n += 1) {
    for (let i = 0; i <= WAVE_SIZE; i += 1) table[i] += Math.sin((TAU * n * i) / WAVE_SIZE) / n ** 1.8;
  }
  return table;
})();

/** One held chord: three drifting, detuned voices per note, spread across the stereo field. */
function padChord(out, from, to, notes, level, rand) {
  const attack = 1.4;
  const release = 1.6;
  const start = Math.round(from * SR);
  const length = Math.min(Math.round((to - from + release) * SR), out.L.length - start);
  const hold = Math.round((to - from) * SR);
  const gain = level / Math.sqrt(notes.length * 3);
  for (const note of notes) {
    for (const [cents, spread] of [[-6, -0.65], [1, 0], [7, 0.65]]) {
      const [left, right] = panGains(spread + (rand() - 0.5) * 0.2);
      const rate = 0.07 + rand() * 0.14;
      const offset = rand() * TAU;
      let phase = rand() * WAVE_SIZE;
      let inc = 0;
      for (let i = 0; i < length; i += 1) {
        if (i % 256 === 0) {
          const drift = 1.5 * Math.sin((TAU * rate * i) / SR + offset);
          inc = (hz(note) * 2 ** ((cents + drift) / 1200) * WAVE_SIZE) / SR;
        }
        const index = phase | 0;
        const v = WAVE[index] + (WAVE[index + 1] - WAVE[index]) * (phase - index);
        phase += inc;
        if (phase >= WAVE_SIZE) phase -= WAVE_SIZE;
        const rise = clamp(i / (attack * SR));
        const fall = 1 - clamp((i - hold) / (release * SR));
        const env = rise * rise * (3 - 2 * rise) * fall * fall * (3 - 2 * fall);
        out.L[start + i] += v * env * gain * left;
        out.R[start + i] += v * env * gain * right;
      }
    }
  }
}

/** Two one-pole low-passes in series, with the cutoff following BRIGHTNESS. */
function lowpass(channel) {
  let a = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < channel.length; i += 1) {
    if (i % 64 === 0) a = 1 - Math.exp((-TAU * curve(BRIGHTNESS, i / SR)) / SR);
    s1 += a * (channel[i] - s1);
    s2 += a * (s1 - s2);
    channel[i] = s2;
  }
}

/** Freeverb: eight damped combs into four all-passes, per channel. */
function reverb(input, room = 0.86, damp = 0.32) {
  const scale = SR / 44100;
  const size = input.L.length;
  const predelay = Math.round(0.02 * SR);
  const mono = new Float32Array(size);
  for (let i = predelay; i < size; i += 1) mono[i] = (input.L[i - predelay] + input.R[i - predelay]) * 0.5;
  const wet = bus(size);
  for (const [channel, spread] of [[wet.L, 0], [wet.R, 23]]) {
    for (const tuning of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) {
      const buffer = new Float32Array(Math.round((tuning + spread) * scale));
      let index = 0;
      let store = 0;
      for (let i = 0; i < size; i += 1) {
        const value = buffer[index];
        store = value * (1 - damp) + store * damp;
        buffer[index] = mono[i] + store * room;
        channel[i] += value;
        index = index + 1 === buffer.length ? 0 : index + 1;
      }
    }
    for (const tuning of [556, 441, 341, 225]) {
      const buffer = new Float32Array(Math.round((tuning + spread) * scale));
      let index = 0;
      for (let i = 0; i < size; i += 1) {
        const value = buffer[index];
        buffer[index] = channel[i] + value * 0.5;
        channel[i] = value - channel[i];
        index = index + 1 === buffer.length ? 0 : index + 1;
      }
    }
    for (let i = 0; i < size; i += 1) channel[i] *= 0.05;
  }
  return wet;
}

// The music -------------------------------------------------------------------

/** The film's three notes: short, short, long. */
function motif(out, time, velocity, rand) {
  [[0, 74], [STEP, 76], [STEP * 3, 81]].forEach(([at, note]) => {
    felt(out, time + at + (rand() - 0.5) * 0.008, note, velocity * (0.94 + rand() * 0.12));
  });
}

function playMusic(out, cues, rand) {
  const pad = bus(out.L.length);
  SECTIONS.forEach(([bar, name, texture], index) => {
    const chord = CHORDS[name];
    const from = bar * BAR;
    const to = SECTIONS[index + 1] ? SECTIONS[index + 1][0] * BAR : cues.closing;
    padChord(pad, from, to, chord.pad, 0.11, rand);
    bass(out, from, chord.bass, 0.12);

    const steps = Math.round((to - from) / STEP);
    for (let i = 0; i < steps; i += 1) {
      const human = (rand() - 0.5) * 0.012;
      const touch = 0.9 + rand() * 0.2;
      if (texture === "sparse" && i % 8 % 3 === 0) {
        felt(out, from + i * STEP + human, chord.arp[i % 8], 0.3 * touch);
      }
      if (texture === "flow" || texture === "pulse") {
        felt(out, from + i * STEP + human, chord.arp[i % 8], (i % 4 === 0 ? 0.27 : 0.21) * touch);
      }
      if (texture === "pulse" && i % 2 === 0) {
        felt(out, from + i * STEP, chord.bass + 12, (i % 4 === 0 ? 0.3 : 0.22) * touch, 0);
      }
    }
  });

  motif(out, STEP, 0.46, rand);
  motif(out, 7 * BAR + STEP, 0.33, rand);
  motif(out, 12 * BAR + 2 * STEP, 0.3, rand);

  // The last chord opens wide under the name, rolled from the bottom up.
  padChord(pad, cues.closing, cues.end, FINAL_PAD, 0.13, rand);
  bass(out, cues.closing, 38, 0.14);
  [50, 57, 64, 66, 69, 74].forEach((note, i) => felt(out, cues.closing + i * 0.03, note, 0.29 - i * 0.015));
  motif(out, cues.closing + STEP, 0.42, rand);

  lowpass(pad.L);
  lowpass(pad.R);
  for (let i = 0; i < out.L.length; i += 1) {
    out.L[i] += pad.L[i];
    out.R[i] += pad.R[i];
  }
}

// The effects -----------------------------------------------------------------

function rootAt(time) {
  let root = CHORDS.D.bass;
  for (const [bar, name] of SECTIONS) if (bar * BAR <= time) root = CHORDS[name].bass;
  return root;
}

function playEffects(out, cues, rand) {
  const sweep = (time, seconds, from, to, gain, panFrom = 0, panTo = panFrom) =>
    whoosh(out, time, seconds, from, to, gain, rand, panFrom, panTo);

  // A reading comes up from the sensor: a glassy two-note ping and a rising trail.
  const reading = (time, gain = 1) => {
    bell(out, time, 81, 0.13 * gain, -0.25);
    bell(out, time + 0.085, 88, 0.1 * gain, -0.05);
    sweep(time - 0.12, 0.85, 900, 3200, 0.14 * gain, -0.5, 0.2);
  };
  const ticks = (time, count, gain) => {
    for (let i = 0; i < count; i += 1) tick(out, time + i * 0.11, gain, -0.2);
  };
  // A command goes back into the world, and each kind has its own sound.
  const command = {
    basal(time) {
      mallet(out, time, 71, 0.16, -0.1);
      mallet(out, time + 0.14, 66, 0.15, -0.2);
      ticks(time + 0.3, 2, 0.2);
      sweep(time, 0.8, 2600, 700, 0.12, 0.3, -0.5);
    },
    carbs(time) {
      kalimba(out, time, 74, 0.2, -0.1);
      kalimba(out, time + 0.09, 76, 0.2, -0.05);
      kalimba(out, time + 0.18, 81, 0.22, 0);
      sweep(time, 0.8, 2600, 700, 0.12, 0.3, -0.5);
    },
    bolus(time) {
      mallet(out, time, 62, 0.18, -0.1);
      mallet(out, time + 0.33, 69, 0.14, -0.15);
      ticks(time + 0.05, 7, 0.26);
      sweep(time, 0.8, 2600, 700, 0.12, 0.3, -0.5);
    },
  };
  // The body answers. Only an outcome that held gets the rising chime.
  const answer = (time, settled) => {
    if (settled) {
      [[78, 0], [81, 0.11], [86, 0.22]].forEach(([note, at]) => {
        felt(out, time + at, note, 0.3, 0.1);
        bell(out, time + at, note, 0.04, 0.1);
      });
    } else {
      felt(out, time, 76, 0.3, 0.1);
    }
  };

  sweep(cues.titleEnd - 0.05, 0.95, 220, 1900, 0.42);
  sweep(cues.recapEnd - 0.85, 0.85, 1900, 220, 0.42);
  cues.moves.forEach(([from, to], i) => {
    const inward = i % 2 === 0;
    sweep(from, to - from, inward ? 300 : 1100, inward ? 1100 : 300, 0.24);
  });

  [66, 69, 71].forEach((note, i) => mallet(out, cues.neverTold[i], note, 0.1, -0.4));
  reading(cues.sensor);
  ticks(cues.pump + 0.1, 3, 0.2);
  sweep(cues.pump, 1, 2600, 700, 0.12, 0.5, -0.3);

  for (const beat of cues.beats) {
    mallet(out, beat.from, rootAt(beat.from) + 24, 0.2, -0.45);
    reading(beat.observe);
    command[beat.kind](beat.act);
    answer(beat.respond, beat.settled);
  }

  // The hidden calendar plays upward as each row of it appears.
  [62, 64, 66, 69, 71, 74].forEach((note, i) => mallet(out, cues.rows[i], note, 0.15 + i * 0.012, (i - 2.5) * 0.14));

  [74, 78, 81].forEach((note, i) => bell(out, cues.rings[i], note, 0.09, (i - 1) * 0.4));
  [69, 74, 78].forEach((note, i) => felt(out, cues.bars[i], note, 0.23 + i * 0.015, (i - 1) * 0.3));
  bell(out, cues.bars[2], 90, 0.03, 0.3);
  bell(out, cues.closing, 81, 0.07, 0);
}

// Assembly --------------------------------------------------------------------

/** Returns the music and effects stems with their reverb, and the finished mix. */
export function renderScore(cues) {
  const size = Math.round(cues.end * SR);
  const rand = random(20261102);
  const music = bus(size);
  const effects = bus(size);
  playMusic(music, cues, rand);
  playEffects(effects, cues, rand);

  const finish = (stem, gain, wetLevel) => {
    const wet = reverb(stem);
    for (const side of ["L", "R"]) {
      for (let i = 0; i < size; i += 1) stem[side][i] = (stem[side][i] + wet[side][i] * wetLevel) * gain;
    }
  };
  finish(music, MUSIC_GAIN, 1);
  finish(effects, EFFECTS_GAIN, 0.7);

  // Clear anything below hearing, and land the fade exactly on the picture's last frame.
  const mix = bus(size);
  const fadeIn = 0.02 * SR;
  const fadeOutFrom = (cues.end - 1.1) * SR;
  const fadeOut = 1.1 * SR;
  const dc = 1 - Math.exp((-TAU * 28) / SR);
  for (const side of ["L", "R"]) {
    let floor = 0;
    for (let i = 0; i < size; i += 1) {
      const value = music[side][i] + effects[side][i];
      floor += dc * (value - floor);
      const tail = 1 - clamp((i - fadeOutFrom) / fadeOut);
      mix[side][i] = (value - floor) * clamp(i / fadeIn) * tail * tail;
    }
  }

  let peak = 0;
  for (const side of ["L", "R"]) for (const v of mix[side]) peak = Math.max(peak, Math.abs(v));
  if (peak >= PEAK_LIMIT) throw new Error(`Soundtrack peak ${peak.toFixed(3)} is over the ${PEAK_LIMIT} limit.`);
  return { music, effects, mix, peak };
}

/** 32-bit float stereo WAV. */
export function writeWav(file, { L, R }) {
  const data = L.length * 8;
  const out = Buffer.alloc(44 + data);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(3, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 8, 28);
  out.writeUInt16LE(8, 32);
  out.writeUInt16LE(32, 34);
  out.write("data", 36);
  out.writeUInt32LE(data, 40);
  for (let i = 0; i < L.length; i += 1) {
    out.writeFloatLE(L[i], 44 + i * 8);
    out.writeFloatLE(R[i], 48 + i * 8);
  }
  fs.writeFileSync(file, out);
}
