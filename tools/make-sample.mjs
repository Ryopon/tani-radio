// 開発用のサンプル回を public/_sample/ に生成する。
// 仮のキャラクター素材（SVG）、仮の音声（合成した電子音）、episode.json を作る。
// 本物の素材や音声ができるまでの代用で、生成物はリポジトリに入れない。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '_sample');
const write = (path, data) => {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};

// ---------- 仮のキャラクター素材 ----------

const INK = '#3b2f2f';
const LINE = `fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"`;
const svg = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;

function eyes(left, right, y, s) {
  const both = (draw) => draw(left) + draw(right);
  return {
    neutral: both((x) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${INK}"/>`),
    smile: both((x) => `<path d="M${x - s * 1.6} ${y + s * 0.6} Q${x} ${y - s * 1.8} ${x + s * 1.6} ${y + s * 0.6}" ${LINE}/>`),
    surprise: both((x) => `<circle cx="${x}" cy="${y}" r="${s * 1.9}" fill="#fff" stroke="${INK}" stroke-width="6"/><circle cx="${x}" cy="${y}" r="${s * 0.7}" fill="${INK}"/>`),
    cry: both((x) => `<path d="M${x - s * 1.6} ${y - s * 0.4} Q${x} ${y + s * 1.6} ${x + s * 1.6} ${y - s * 0.4}" ${LINE}/><ellipse cx="${x}" cy="${y + s * 3.2}" rx="${s * 0.8}" ry="${s * 1.4}" fill="#6bb7e8"/>`),
    void: both((x) => `<circle cx="${x}" cy="${y}" r="${s * 1.3}" fill="none" stroke="${INK}" stroke-width="5"/>`),
    jito: both((x) => `<path d="M${x - s * 1.7} ${y - s * 0.3} H${x + s * 1.7}" ${LINE}/><path d="M${x - s * 1.1} ${y} A${s * 1.1} ${s * 1.1} 0 0 0 ${x + s * 1.1} ${y} Z" fill="${INK}"/>`),
    blink: both((x) => `<path d="M${x - s * 1.5} ${y} H${x + s * 1.5}" ${LINE}/>`),
  };
}

function mouths(x, y, s) {
  return {
    neutral: `<path d="M${x - s} ${y} H${x + s}" ${LINE}/>`,
    smile: `<path d="M${x - s * 1.4} ${y - s * 0.3} Q${x} ${y + s * 1.4} ${x + s * 1.4} ${y - s * 0.3}" ${LINE}/>`,
    surprise: `<ellipse cx="${x}" cy="${y}" rx="${s * 0.7}" ry="${s * 0.9}" fill="${INK}"/>`,
    cry: `<path d="M${x - s * 1.3} ${y + s * 0.5} Q${x} ${y - s} ${x + s * 1.3} ${y + s * 0.5}" ${LINE}/>`,
    void: `<path d="M${x - s * 0.5} ${y} H${x + s * 0.5}" ${LINE}/>`,
    jito: `<path d="M${x - s} ${y + s * 0.3} Q${x} ${y - s * 0.5} ${x + s} ${y + s * 0.3}" ${LINE}/>`,
    half: `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${s * 0.5}" fill="${INK}"/>`,
    open: `<ellipse cx="${x}" cy="${y}" rx="${s * 1.1}" ry="${s * 1.1}" fill="${INK}"/>`,
  };
}

const FACES = ['neutral', 'smile', 'surprise', 'cry', 'void', 'jito'];

function writeCharacter(name, { width, height, stage, baseLayers, eyeSet, mouthSet, talk, poses }) {
  const dir = `chars/${name}/`;
  for (const [id, { inner }] of Object.entries(baseLayers)) write(`${dir}${id}.svg`, svg(width, height, inner));
  for (const [key, inner] of Object.entries(eyeSet)) write(`${dir}eyes_${key}.svg`, svg(width, height, inner));
  for (const [key, inner] of Object.entries(mouthSet)) write(`${dir}mouth_${key}.svg`, svg(width, height, inner));

  const layerOrder = Object.entries(baseLayers).map(([id, { origin, after }]) => ({ id, origin, after }));
  const layers = [];
  for (const layer of layerOrder.filter((l) => !l.after)) layers.push({ id: layer.id, image: `${layer.id}.svg`, origin: layer.origin });
  layers.push({ id: 'eyes' }, { id: 'mouth' });
  for (const layer of layerOrder.filter((l) => l.after)) layers.push({ id: layer.id, image: `${layer.id}.svg`, origin: layer.origin });

  const rig = {
    width,
    height,
    stage,
    layers,
    faces: Object.fromEntries(FACES.map((f) => [f, { eyes: `eyes_${f}.svg`, mouth: `mouth_${f}.svg` }])),
    talk: talk ? { layer: 'mouth', half: 'mouth_half.svg', open: 'mouth_open.svg' } : undefined,
    blink: { layer: 'eyes', image: 'eyes_blink.svg', faces: ['neutral', 'surprise', 'jito'] },
    poses,
    poke: { faces: ['surprise', 'smile'] },
  };
  write(`${dir}rig.json`, JSON.stringify(rig, null, 2));
}

writeCharacter('ryopon', {
  width: 400,
  height: 620,
  stage: { cx: 330, bottom: 940, height: 620 },
  baseLayers: {
    body: { inner: `<rect x="90" y="300" width="220" height="330" rx="70" fill="#7aa6c2"/>` },
    head: { inner: `<circle cx="200" cy="180" r="130" fill="#f6d9c0"/><path d="M70 180 A130 130 0 0 1 330 180 Q200 85 70 180Z" fill="#5a4636"/>` },
    arm: { inner: `<rect x="285" y="320" width="56" height="210" rx="28" fill="#6a94b0"/>`, origin: [313 / 400, 345 / 620], after: true },
  },
  eyeSet: eyes(155, 245, 195, 11),
  mouthSet: mouths(200, 250, 20),
  talk: true,
  poses: {
    default: {},
    wave: { arm: { rotate: -140 } },
    point: { arm: { rotate: -90 } },
    handToMouth: { arm: { rotate: 135 } },
  },
});

writeCharacter('mui', {
  width: 320,
  height: 310,
  stage: { cx: 730, bottom: 940, height: 310 },
  baseLayers: {
    ears: {
      inner: [115, 205].map((x) => `<ellipse cx="${x}" cy="85" rx="27" ry="78" fill="#fffaf2" stroke="${INK}" stroke-width="5"/><ellipse cx="${x}" cy="90" rx="12" ry="52" fill="#f7c6cf"/>`).join(''),
      origin: [0.5, 0.5],
    },
    body: { inner: `<ellipse cx="160" cy="205" rx="145" ry="100" fill="#fffaf2" stroke="${INK}" stroke-width="5"/><circle cx="85" cy="225" r="16" fill="#f7c6cf" opacity="0.7"/><circle cx="235" cy="225" r="16" fill="#f7c6cf" opacity="0.7"/>` },
  },
  eyeSet: eyes(115, 205, 190, 9),
  mouthSet: mouths(160, 222, 10),
  talk: false,
  poses: {
    default: {},
    earsUp: { ears: { translate: [0, -22], scale: [1, 1.15] } },
    earsDown: { ears: { translate: [0, 28], scale: [1, 0.55] } },
    lean: { _root: { translate: [-24, 0], rotate: -8 } },
    hop: { _root: { translate: [0, -40] }, ears: { translate: [0, -12], scale: [1, 1.1] } },
    turnAway: { _root: { scale: [-1, 1], rotate: 6 } },
  },
});

write(
  'img/bg.svg',
  svg(
    1000,
    1000,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f5"/><stop offset="1" stop-color="#fdf3dc"/></linearGradient></defs>
<rect width="1000" height="1000" fill="url(#sky)"/>
<circle cx="820" cy="170" r="70" fill="#fff3b0"/>
<path d="M0 640 Q250 480 520 620 T1000 560 V1000 H0Z" fill="#a9d6a0"/>
<path d="M0 760 Q300 660 620 760 T1000 720 V1000 H0Z" fill="#8cc68a"/>
<rect x="0" y="900" width="1000" height="100" fill="#c9a27a"/>`,
  ),
);

// ---------- 台本 ----------

const script = [
  { chapter: { id: 'op', title: 'オープニング' } },
  { who: 'ryopon', text: 'おはようございます。谷ラジオ、サンプル放送です。', face: 'smile', pose: 'wave' },
  { who: 'mui', text: '（おはよう！）', face: 'smile', pose: 'hop', emote: '♪' },
  { who: 'ryopon', text: 'この回は、再生エンジンの動作確認用に作ったものです。' },

  { chapter: { id: 'news', title: 'ニュース' } },
  { item: 'サンプルニュース その1', card: { title: '字幕と目次が音声に合わせて動く', body: '画面の状態は、音声の再生位置から毎フレーム計算しています。' } },
  { who: 'ryopon', text: '最初のニュースです。字幕と目次が、音声に合わせて動きます。', pose: 'point' },
  { who: 'mui', text: '（いいね！）', face: 'smile', pose: 'earsUp', emote: '！' },
  { who: 'ryopon', text: '目次をタップすると、その場所へジャンプできます。' },
  { item: 'サンプルニュース その2', card: { title: 'キャラクターをつつける', body: 'つつくと反応します。番組の進行には影響しません。' } },
  { who: 'ryopon', text: '次のニュースです。キャラクターをつつくと、反応します。' },
  { who: 'mui', text: '（つついてみて）', pose: 'lean' },
  { who: 'ryopon', text: 'つついても、番組の進行は変わりません。', face: 'smile' },

  { chapter: { id: 'trivia', title: '知らないことを知ろう' } },
  { who: 'ryopon', text: '続いて、知らないことを知ろうのコーナーです。', pose: 'handToMouth' },
  { who: 'ryopon', text: 'うさぎの耳は、音を聞くだけでなく、体温の調節にも使われています。' },
  { who: 'mui', text: '（そうなの？）', face: 'surprise', pose: 'earsUp', emote: '？' },
  { who: 'ryopon', text: 'ちょっと適当に言いました。', face: 'void' },
  { who: 'mui', text: '（……）', face: 'jito', pose: 'turnAway' },
  { who: 'ryopon', text: 'すみません、これは本当の話です。', face: 'cry' },

  { chapter: { id: 'ed', title: 'エンディング' } },
  { who: 'ryopon', text: '以上、サンプル放送でした。また明日。', face: 'smile', pose: 'wave' },
  { who: 'mui', text: '（またね！）', face: 'smile', pose: 'hop', emote: '♪' },
];

// ---------- 時刻の割り当てと仮音声の合成 ----------

const RATE = 16000;
const CHAR = 0.11; // ryopon の1文字あたりの秒数
const PAUSE = 0.22; // 句読点の間
const GAP = 0.45; // セリフ間の間
const MUI_LINE = 1.3;
const round = (n) => Math.round(n * 1000) / 1000;

const tones = []; // { start, dur, freq, freqEnd, amp }
const tracks = { subtitle: [], ryoponMouth: [], ryoponFace: [], ryoponPose: [], muiFace: [], muiPose: [], emote: [], scene: [], card: [] };
const chapters = [];
const lines = []; // { who, start, end, face, pose }
let openCard = null;
let t = 0.6;

for (const entry of script) {
  if (entry.chapter) {
    if (openCard) { openCard.end = round(t); openCard = null; }
    chapters.push({ ...entry.chapter, start: round(t) });
    continue;
  }
  if (entry.item) {
    const chapter = chapters[chapters.length - 1];
    (chapter.items ??= []).push({ title: entry.item, start: round(t) });
    if (openCard) openCard.end = round(t);
    openCard = { start: round(t), end: 0, kind: 'news', ...entry.card, image: null, source: { name: 'サンプル', url: 'https://example.com/' } };
    tracks.card.push(openCard);
    continue;
  }

  const start = t;
  if (entry.who === 'ryopon') {
    for (const ch of entry.text) {
      if ('、。！？'.includes(ch)) { t += PAUSE; continue; }
      tones.push({ start: t, dur: CHAR * 0.8, freq: 170 + (ch.codePointAt(0) % 6) * 14, amp: 0.22 });
      tracks.ryoponMouth.push({ start: round(t), end: round(t + CHAR * 0.6), shape: 'open' }, { start: round(t + CHAR * 0.6), end: round(t + CHAR), shape: 'half' });
      t += CHAR;
    }
  } else {
    tones.push({ start: t + 0.05, dur: 0.14, freq: 700, freqEnd: 1150, amp: 0.28 });
    t += MUI_LINE;
  }
  tracks.subtitle.push({ start: round(start), end: round(t), who: entry.who, text: entry.text });
  lines.push({ who: entry.who, start, end: t, face: entry.face, pose: entry.pose });
  if (entry.emote) tracks.emote.push({ start: round(start), end: round(start + 1.6), who: entry.who, symbol: entry.emote });
  t += GAP;
}
const duration = round(t + 1.0);
if (openCard) openCard.end = duration;
tracks.scene.push({ start: 0, end: duration, background: 'img/bg.svg' });

// 表情とポーズは、同じ話者の次のセリフが始まるまで保つ（最長でセリフ終了の6秒後まで）。
for (const who of ['ryopon', 'mui']) {
  const own = lines.filter((l) => l.who === who);
  own.forEach((line, i) => {
    const until = Math.min(own[i + 1]?.start ?? duration, line.end + 6);
    if (line.face) tracks[`${who}Face`].push({ start: round(line.start), end: round(until), face: line.face });
    if (line.pose) tracks[`${who}Pose`].push({ start: round(line.start), end: round(until), pose: line.pose });
  });
}

// 仮のBGM: 小さな音量の分散和音。
const bgmNotes = [261.6, 329.6, 392.0, 440.0, 392.0, 329.6];
for (let i = 0; i * 0.5 < duration - 0.5; i++) tones.push({ start: i * 0.5, dur: 0.45, freq: bgmNotes[i % bgmNotes.length], amp: 0.035 });

const samples = new Float32Array(Math.ceil(duration * RATE));
for (const tone of tones) {
  const from = Math.floor(tone.start * RATE);
  const count = Math.floor(tone.dur * RATE);
  let phase = 0;
  for (let i = 0; i < count && from + i < samples.length; i++) {
    const p = i / count;
    const freq = tone.freqEnd ? tone.freq + (tone.freqEnd - tone.freq) * p : tone.freq;
    phase += (2 * Math.PI * freq) / RATE;
    const envelope = Math.min(1, p * 12) * Math.min(1, (1 - p) * 5);
    samples[from + i] += (Math.sin(phase) + 0.3 * Math.sin(phase * 2)) * tone.amp * envelope;
  }
}

const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + samples.length * 2, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(1, 22); // モノラル
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
write('audio.wav', wav);

write(
  'episode.json',
  JSON.stringify(
    {
      schema: 1,
      date: '2026-01-01',
      title: 'サンプル放送（動作確認用）',
      duration,
      audio: 'audio.wav',
      characters: { ryopon: 'chars/ryopon/', mui: 'chars/mui/' },
      chapters,
      tracks,
      sources: [{ title: 'サンプルの出典', name: 'サンプル', url: 'https://example.com/' }],
      credits: ['仮の音声と素材は tools/make-sample.mjs で生成'],
    },
    null,
    1,
  ),
);

console.log(`サンプル回を生成しました: ${out}（${duration}秒）`);
