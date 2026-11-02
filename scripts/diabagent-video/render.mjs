/**
 * Render the DiabAgent overview video from the recorded C04 run.
 *
 * Offline preparation; normal site builds use the committed mp4. Needs Chrome and
 * a tools directory holding puppeteer-core and ffmpeg-static, kept out of the
 * site's dependencies:
 *
 *   npm i --prefix <tools> puppeteer-core ffmpeg-static
 *   VIDEO_TOOLS=<tools> node scripts/diabagent-video/render.mjs [--frames 20,60,90] [--audio]
 *
 * --frames writes single PNG stills to $VIDEO_TOOLS/stills for review.
 * --audio rebuilds the soundtrack (score.mjs) onto the existing picture, without re-rendering it.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { renderScore, writeWav } from "./score.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const tools = process.env.VIDEO_TOOLS;
if (!tools) throw new Error("Set VIDEO_TOOLS to the directory with puppeteer-core and ffmpeg-static.");
const require = createRequire(path.join(path.resolve(tools), "package.json"));
const puppeteer = require("puppeteer-core");
const ffmpeg = require("ffmpeg-static");

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 60;
const DAY_START = 2880;
const KEY = "c04-child-male";
const MODEL = "opus55";

const task = JSON.parse(gunzipSync(fs.readFileSync(path.join(repo, `public/diabagent/runs/${KEY}.json.gz`))).toString());
const run = task.runs[MODEL];
assert(task.start === 0, "The day labels below assume the episode starts at local midnight.");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

/** The recorded day, as minutes from local midnight on day 3. */
function recordedDay() {
  const truth = run.truth.map((v, i) => [i * 5 - DAY_START, v]).filter(([m]) => m >= 0 && m <= 1440);
  const cgm = run.cgm.map((v, i) => [(i + 1) * 5 - DAY_START, v]).filter(([m]) => m >= 0 && m <= 1440);
  const basal = [];
  run.basal.forEach(([m, pct], i) => {
    const next = run.basal[i + 1]?.[0] ?? 4320;
    if (next <= DAY_START || m >= 4320) return;
    basal.push([Math.max(m - DAY_START, 0), pct]);
  });
  const acts = run.acts.filter(([m]) => m >= DAY_START && m < 4320).map(([m, ...rest]) => [m - DAY_START, ...rest]);
  const events = task.events
    .filter(([m]) => m >= DAY_START && m < 4320)
    .map(([m, end, type, grams]) => ({ m: m - DAY_START, end: end == null ? null : end - DAY_START, type, grams }));

  const samples = truth.slice(1).map(([, v]) => v);
  const tir = (100 * samples.filter((v) => v >= 72.064 && v <= 144.128).length) / samples.length;
  const below = (100 * samples.filter((v) => v < 70).length) / samples.length;
  const others = Object.entries(task.runs).filter(([id]) => id !== MODEL).sort((a, b) => b[1].score - a[1].score);
  const names = { gpt61: "GPT 6.1 Sol", deepseek41: "DeepSeek 4.1 Flash", kimi31: "Kimi K3.1 Pro", glm53flash: "GLM 5.3 Flash" };

  const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const exercise = events.filter((e) => e.type === "exercise");
  const meals = events.filter((e) => e.type === "meal");
  const hours = (e) => `${(e.end - e.m) / 60} h`;
  assert(exercise.length === 2 && meals.length === 3, "Unexpected hidden calendar for the day.");
  const reveal = [
    ["06:45", "No breakfast, no lunch"],
    [clock(exercise[0].m), `Exercise, ${hours(exercise[0])}`],
    [clock(exercise[1].m), `Exercise, ${hours(exercise[1])}`],
    [clock(meals[0].m), `Late lunch, ${Math.round(meals[0].grams)} g`],
    [clock(meals[1].m), `Dinner, ${Math.round(meals[1].grams)} g`],
    [clock(meals[2].m), `Snack, ${Math.round(meals[2].grams)} g`],
  ];

  return {
    truth,
    cgm,
    basal,
    acts,
    events,
    reveal,
    summary: {
      day: { score: run.daily[2], tir, below },
      daily: run.daily,
      whole: run.score,
      nextBest: others[0][1].score,
      nextBestName: names[others[0][0]],
    },
  };
}

const day = recordedDay();
console.log("Summary", JSON.stringify(day.summary), "reveal", JSON.stringify(day.reveal));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--allow-file-access-from-files", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument((data) => {
  window.DAY = data;
}, day);
await page.goto(`file://${path.join(here, "scene.html")}`);
await page.evaluate(() => document.fonts.load('400 32px Inter').then(() => document.fonts.ready));

// Quotes and readings on screen must be what the run recorded.
const moments = await page.evaluate(() => window.MOMENTS);
const reading = (minute) => day.cgm.find(([m]) => m === minute)?.[1];
for (const moment of moments) {
  const act = day.acts.find(([m]) => m === moment.m);
  assert(act, `No recorded action at minute ${moment.m}`);
  for (const piece of moment.quote) assert(act[3].includes(piece), `Not verbatim at ${moment.m}: ${piece}`);
  assert(reading(moment.m) === moment.reading, `Reading at ${moment.m} is ${reading(moment.m)}, scene says ${moment.reading}`);
}
// The response cards quote these readings.
assert(reading(600) === 96, `Reading at 10:00 is ${reading(600)}`);
assert(reading(1320) === 99, `Reading at 22:00 is ${reading(1320)}`);
const afterDose = day.cgm.filter(([m, v]) => m >= 1200 && m <= 1260 && v != null);
const peak = afterDose.reduce((a, b) => (b[1] > a[1] ? b : a));
assert(peak[0] === 1225 && peak[1] === 191, `Peak after the dinner dose is ${peak[1]} at minute ${peak[0]}`);
// The chart joins across a missed reading, which is only fair while each gap is a single reading.
assert(
  day.cgm.every(([, v], i, all) => v != null || (all[i - 1]?.[1] != null && all[i + 1]?.[1] != null)),
  "The sensor line has a gap longer than one reading.",
);

const duration = await page.evaluate(() => window.DURATION);
const posterTime = await page.evaluate(() => window.POSTER_TIME);
const grab = (t, type = "image/png", quality) =>
  page.evaluate(
    (time, kind, q) => {
      window.drawFrame(time);
      return document.getElementById("c").toDataURL(kind, q).split(",")[1];
    },
    t,
    type,
    quality,
  );

const framesArg = process.argv.indexOf("--frames");
if (framesArg > 0) {
  const stills = path.join(path.resolve(tools), "stills");
  fs.mkdirSync(stills, { recursive: true });
  for (const t of process.argv[framesArg + 1].split(",").map(Number)) {
    fs.writeFileSync(path.join(stills, `t${String(t).padStart(5, "0")}.png`), Buffer.from(await grab(t), "base64"));
  }
  console.log(`duration ${duration.toFixed(1)} s, stills in ${stills}`);
  await browser.close();
  process.exit(0);
}

const outDir = path.join(repo, "public/diabagent/video");
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, "one-day.mp4");
const picture = path.join(path.resolve(tools), "one-day-picture.mp4");
const soundtrack = path.join(path.resolve(tools), "one-day-score.wav");

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    spawn(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" }).on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });

/** Lay the soundtrack onto the picture, leaving the picture's own bytes untouched. */
async function addSoundtrack() {
  const cues = await page.evaluate(() => window.CUES);
  const { mix, peak } = renderScore(cues);
  writeWav(soundtrack, mix);
  await runFfmpeg([
    "-i", picture, "-i", soundtrack,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    target,
  ]);
  console.log(`one-day.mp4: ${(fs.statSync(target).size / 1e6).toFixed(2)} MB, ${duration.toFixed(1)} s, soundtrack peak ${peak.toFixed(3)}`);
}

if (process.argv.includes("--audio")) {
  fs.copyFileSync(target, picture);
  await addSoundtrack();
  await browser.close();
  process.exit(0);
}

fs.writeFileSync(path.join(outDir, "poster.jpg"), Buffer.from(await grab(posterTime, "image/jpeg", 0.86), "base64"));

const encoder = spawn(
  ffmpeg,
  [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-tune", "animation",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    picture,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const finished = new Promise((resolve, reject) => {
  encoder.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
});

const frames = Math.ceil(duration * FPS);
for (let i = 0; i < frames; i += 1) {
  const frame = Buffer.from(await grab(i / FPS), "base64");
  if (!encoder.stdin.write(frame)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
  if (i % 300 === 0) console.log(`frame ${i}/${frames}`);
}
encoder.stdin.end();
await finished;
await addSoundtrack();
await browser.close();
