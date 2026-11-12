import { Stage } from './stage';
import { activeAt } from './timeline';
import type { CardSeg, Episode, SubtitleSeg } from './types';

interface Jump {
  id: string;
  /** コーナー名 */
  chapter: string;
  /** コーナー内の項目名。コーナーそのものなら空。 */
  item: string;
  start: number;
}

/** CSS の横長レイアウトと同じ条件。目次をどこに置くかの判断に使う。 */
const WIDE_QUERY = '(min-width: 960px) and (min-aspect-ratio: 5/4)';

// アイコンは lucide（ISC License）の線画を、1つの大きさと線幅で使う。
const ICONS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  back: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  forward: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  captions: '<rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
  script:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
} as const;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // 上の定数だけを入れる。台本データは入れない。
  return svg;
}

function iconButton(name: keyof typeof ICONS, label: string, className = ''): HTMLButtonElement {
  const button = h('button', `btn ${className}`.trim(), '', { type: 'button', 'aria-label': label, title: label });
  button.append(icon(name));
  return button;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 台本データ由来のURLは http(s) だけを通す。 */
function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** 画面に重ねて開く面。中だけがスクロールし、ページ自体は動かない。 */
function makeSheet(title: string): { dialog: HTMLDialogElement; body: HTMLDivElement } {
  const dialog = h('dialog', 'sheet');
  const head = h('div', 'sheet-head');
  const close = iconButton('close', '閉じる');
  close.addEventListener('click', () => dialog.close());
  head.append(h('h2', 'sheet-title', title), close);
  const body = h('div', 'sheet-body');
  dialog.append(head, body);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // 外側をタップしたら閉じる
  });
  return { dialog, body };
}

/** ダイヤルの目盛り。細かい目盛りは一定秒ごと、長い目盛りはコーナーの区切り。 */
function dialScale(duration: number, chapterStarts: number[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${duration} 10`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'dial-scale');
  svg.setAttribute('aria-hidden', 'true');
  const line = (x: number, top: number, className: string): void => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(x));
    el.setAttribute('x2', String(x));
    el.setAttribute('y1', String(top));
    el.setAttribute('y2', '10');
    el.setAttribute('class', className);
    svg.append(el);
  };
  const step = duration <= 120 ? 5 : duration <= 360 ? 10 : 15;
  for (let x = step; x < duration; x += step) line(x, 6, 'tick');
  for (const x of chapterStarts) if (x > 0) line(x, 1, 'tick tick-chapter');
  return svg;
}

const SPEAKER = { ryopon: 'りょぽん', mui: 'むい' } as const;
const RATES = [1, 1.25, 1.5, 2];

export async function startApp(root: HTMLElement, episode: Episode, base: URL): Promise<void> {
  const duration = episode.duration;
  const audio = new Audio(new URL(episode.audio, base).href);
  audio.preload = 'auto';
  const stage = await Stage.create(episode, base);

  const jumps: Jump[] = episode.chapters.flatMap((chapter) => [
    { id: chapter.id, chapter: chapter.title, item: '', start: chapter.start },
    ...(chapter.items ?? []).map((item, i) => ({ id: `${chapter.id}-${i + 1}`, chapter: chapter.title, item: item.title, start: item.start })),
  ]);

  // ---------- 続きから再生（保存できない環境では何もしない） ----------
  const positionKey = `tani-radio:position:${episode.date}`;
  const loadPosition = (): number => {
    try {
      const saved = Number(localStorage.getItem(positionKey));
      return saved > 5 && saved < duration - 5 ? saved : 0;
    } catch {
      return 0;
    }
  };
  let lastSaved = 0;
  const savePosition = (t: number): void => {
    lastSaved = t;
    try {
      localStorage.setItem(positionKey, String(Math.floor(t)));
    } catch {
      /* 保存できなくても再生は続ける */
    }
  };

  // ---------- 舞台に重ねるもの ----------
  const subtitle = h('div', 'subtitle empty');
  const now = h('section', 'now');
  now.hidden = true;

  const topbar = h('div', 'topbar');
  topbar.append(h('span', 'wordmark', '谷ラジオ'), h('span', 'date', episode.date));

  // ---------- 番組表（目次）。横長では左に常時表示、縦長では面として開く ----------
  const program = h('nav', 'program', '', { 'aria-label': '番組表' });
  program.append(h('p', 'program-date', episode.date), h('p', 'program-title', episode.title));
  const rows = h('div', 'rows');
  const jumpButtons = jumps.map((jump) => {
    const row = h('button', jump.item ? 'row row-item' : 'row', '', { type: 'button' });
    row.append(h('span', 'row-mark'), h('span', 'row-title', jump.item || jump.chapter), h('span', 'row-time', formatTime(jump.start)));
    row.addEventListener('click', () => {
      programSheet.dialog.close();
      history.replaceState(null, '', `#${jump.id}`);
      if (overlay.isConnected) begin(jump.start);
      else {
        seekTo(jump.start);
        void audio.play().catch(() => {});
      }
    });
    rows.append(row);
    return row;
  });
  program.append(rows);

  const side = h('aside', 'side');
  side.append(h('p', 'wordmark', '谷ラジオ'));
  const programSheet = makeSheet('番組表');
  const wide = matchMedia(WIDE_QUERY);
  const placeProgram = (): void => {
    if (wide.matches) {
      if (programSheet.dialog.open) programSheet.dialog.close();
      side.append(program);
    } else {
      programSheet.body.append(program);
    }
  };
  wide.addEventListener('change', placeProgram);
  placeProgram();

  // ---------- 台本の全文、出典、クレジット ----------
  const scriptSheet = makeSheet('台本と出典');
  let chapterIndex = 0;
  for (const seg of episode.tracks.subtitle ?? []) {
    while (chapterIndex < episode.chapters.length && episode.chapters[chapterIndex].start <= seg.start) {
      scriptSheet.body.append(h('h3', 'script-chapter', episode.chapters[chapterIndex].title));
      chapterIndex++;
    }
    const line = h('button', `line who-${seg.who}`, '', { type: 'button' });
    line.append(h('span', 'line-who', SPEAKER[seg.who]), h('span', 'line-text', seg.text));
    line.addEventListener('click', () => {
      scriptSheet.dialog.close();
      seekTo(seg.start);
    });
    scriptSheet.body.append(line);
  }
  if (episode.sources?.length) {
    scriptSheet.body.append(h('h3', 'script-chapter', '出典'));
    const list = h('ul', 'plain-list');
    for (const source of episode.sources) {
      const item = h('li');
      const url = safeUrl(source.url);
      if (url) item.append(h('a', '', `${source.title}（${source.name}）`, { href: url, target: '_blank', rel: 'noopener noreferrer' }));
      else item.textContent = `${source.title}（${source.name}）`;
      list.append(item);
    }
    scriptSheet.body.append(list);
  }
  if (episode.credits?.length) {
    scriptSheet.body.append(h('h3', 'script-chapter', 'クレジット'));
    const list = h('ul', 'plain-list');
    for (const credit of episode.credits) list.append(h('li', '', credit));
    scriptSheet.body.append(list);
  }

  // ---------- 操作盤。シークバーはラジオのダイヤル ----------
  const transport = h('div', 'transport');

  const readout = h('div', 'readout');
  const readoutChapter = h('span', 'readout-chapter');
  const readoutItem = h('span', 'readout-item');
  readout.append(readoutChapter, readoutItem);
  const time = h('span', 'time', `0:00 / ${formatTime(duration)}`);

  const dial = h('div', 'dial');
  const seek = h('input', 'dial-input', '', { type: 'range', min: '0', max: String(duration), step: '0.1', value: '0', 'aria-label': '再生位置' });
  dial.append(
    dialScale(
      duration,
      episode.chapters.map((chapter) => chapter.start),
    ),
    h('div', 'dial-played'),
    h('div', 'dial-needle'),
    seek,
  );

  const mainKeys = h('div', 'keys keys-main');
  const back = iconButton('back', '10秒戻る', 'btn-skip');
  back.append(h('span', 'btn-num', '10'));
  const play = iconButton('play', '再生', 'btn-play');
  const forward = iconButton('forward', '10秒進む', 'btn-skip');
  forward.append(h('span', 'btn-num', '10'));
  mainKeys.append(back, play, forward);

  const subKeys = h('div', 'keys keys-sub');
  const speed = h('button', 'btn btn-text', '1×', { type: 'button', 'aria-label': '再生速度 1倍', title: '再生速度' });
  const subtitleToggle = iconButton('captions', '字幕', 'btn-toggle');
  subtitleToggle.setAttribute('aria-pressed', 'true');
  const programButton = iconButton('list', '番組表', 'btn-program');
  const scriptButton = iconButton('script', '台本と出典');
  subKeys.append(speed, subtitleToggle, programButton, scriptButton);

  transport.append(readout, time, dial, mainKeys, subKeys);

  // ---------- 開始画面（自動再生制限のため、ボタンを押してから音を出す） ----------
  const overlay = h('div', 'start');
  const startBox = h('div', 'start-box');
  const startButton = h('button', 'start-btn', '番組をはじめる', { type: 'button' });
  startBox.append(h('p', 'start-date', episode.date), h('p', 'start-title', episode.title), startButton);
  overlay.append(startBox);
  const hashJump = jumps.find((jump) => `#${jump.id}` === location.hash);
  function begin(at: number): void {
    overlay.remove();
    seekTo(at);
    void audio.play().catch(() => {});
  }
  startButton.addEventListener('click', () => begin(hashJump?.start ?? 0));
  const resumeAt = loadPosition();
  if (resumeAt > 0 && !hashJump) {
    const resume = h('button', 'start-btn start-btn-sub', `続きから ${formatTime(resumeAt)}`, { type: 'button' });
    resume.addEventListener('click', () => begin(resumeAt));
    startBox.append(resume);
  }

  root.className = 'app';
  root.replaceChildren(stage.el, topbar, side, now, subtitle, transport, overlay, programSheet.dialog, scriptSheet.dialog);

  // ---------- 操作 ----------
  function seekTo(t: number): void {
    audio.currentTime = Math.min(Math.max(t, 0), duration - 0.05);
  }
  const toggle = (): void => {
    if (overlay.isConnected) begin(hashJump?.start ?? 0);
    else if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  };
  const chapterStep = (direction: 1 | -1): void => {
    const t = audio.currentTime;
    const starts = episode.chapters.map((chapter) => chapter.start);
    const target = direction > 0 ? starts.find((s) => s > t + 0.5) : [...starts].reverse().find((s) => s < t - 2);
    seekTo(target ?? (direction > 0 ? duration : 0));
  };

  play.addEventListener('click', toggle);
  back.addEventListener('click', () => seekTo(audio.currentTime - 10));
  forward.addEventListener('click', () => seekTo(audio.currentTime + 10));
  seek.addEventListener('input', () => seekTo(Number(seek.value)));
  speed.addEventListener('click', () => {
    const rate = RATES[(RATES.indexOf(audio.playbackRate) + 1) % RATES.length];
    audio.playbackRate = rate;
    speed.textContent = `${rate}×`;
    speed.setAttribute('aria-label', `再生速度 ${rate}倍`);
  });
  let subtitlesOn = true;
  subtitleToggle.addEventListener('click', () => {
    subtitlesOn = !subtitlesOn;
    subtitleToggle.setAttribute('aria-pressed', String(subtitlesOn));
  });
  programButton.addEventListener('click', () => programSheet.dialog.showModal());
  scriptButton.addEventListener('click', () => scriptSheet.dialog.showModal());

  document.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).closest('input, button, a, dialog')) return;
    if (event.key === ' ') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'ArrowLeft') seekTo(audio.currentTime - 10);
    else if (event.key === 'ArrowRight') seekTo(audio.currentTime + 10);
  });

  // ロック画面や通知からの操作
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: episode.title, artist: '谷ラジオ', album: episode.date });
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => void audio.play().catch(() => {})],
      ['pause', () => audio.pause()],
      ['seekbackward', () => seekTo(audio.currentTime - 10)],
      ['seekforward', () => seekTo(audio.currentTime + 10)],
      ['previoustrack', () => chapterStep(-1)],
      ['nexttrack', () => chapterStep(1)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* 対応していない操作は無視する */
      }
    }
  }

  // つつきの反応音。番組の音声とは別に鳴らす。
  let audioContext: AudioContext | undefined;
  stage.onPoke = (who) => {
    try {
      audioContext ??= new AudioContext();
      const ctx = audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const from = who === 'mui' ? 760 : 420;
      osc.frequency.setValueAtTime(from, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(from * 1.6, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      /* 音が出せなくても反応の動きは出る */
    }
  };

  // ---------- 描画ループ: 画面はすべて再生位置から求める ----------
  let shownSubtitle: SubtitleSeg | undefined;
  let shownCard: CardSeg | undefined;
  let shownJump = -2;
  let shownSecond = -1;
  let shownProgress = -1;
  let shownPaused: boolean | undefined;

  function renderCard(seg: CardSeg | undefined): void {
    now.hidden = !seg;
    if (!seg) return;
    const card = h('article', 'card');
    card.append(h('h2', 'card-title', seg.title), h('p', 'card-body', seg.body));
    if (seg.image) {
      const img = h('img', 'card-image', '', { alt: '' });
      img.src = new URL(seg.image, base).href;
      card.append(img);
    }
    const url = seg.source && safeUrl(seg.source.url);
    if (seg.source && url) {
      card.append(h('a', 'card-source', `出典 ${seg.source.name}`, { href: url, target: '_blank', rel: 'noopener noreferrer' }));
    }
    now.replaceChildren(card);
  }

  function frame(): void {
    const t = audio.currentTime;
    stage.render(t, performance.now());

    const sub = subtitlesOn && !overlay.isConnected ? activeAt(episode.tracks.subtitle, t) : undefined;
    if (sub !== shownSubtitle) {
      shownSubtitle = sub;
      if (sub) subtitle.textContent = sub.text;
      subtitle.className = sub ? `subtitle who-${sub.who}` : 'subtitle empty';
    }

    const cardSeg = activeAt(episode.tracks.card, t);
    if (cardSeg !== shownCard) {
      shownCard = cardSeg;
      renderCard(cardSeg);
    }

    let jumpIndex = -1;
    for (let i = 0; i < jumps.length; i++) if (jumps[i].start <= t + 0.01) jumpIndex = i;
    if (jumpIndex !== shownJump) {
      shownJump = jumpIndex;
      jumpButtons.forEach((button, i) => {
        if (i === jumpIndex) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      const jump = jumps[jumpIndex];
      readoutChapter.textContent = jump?.chapter ?? '';
      readoutItem.textContent = jump?.item ?? '';
    }

    const progress = t / duration;
    if (Math.abs(progress - shownProgress) > 0.0005) {
      shownProgress = progress;
      dial.style.setProperty('--p', progress.toFixed(4));
      seek.value = String(t);
    }
    const second = Math.floor(t);
    if (second !== shownSecond) {
      shownSecond = second;
      time.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
      seek.setAttribute('aria-valuetext', `${formatTime(t)}、全体 ${formatTime(duration)}`);
    }
    if (audio.paused !== shownPaused) {
      shownPaused = audio.paused;
      play.replaceChildren(icon(audio.paused ? 'play' : 'pause'));
      const label = audio.paused ? '再生' : '一時停止';
      play.setAttribute('aria-label', label);
      play.title = label;
    }
    if (Math.abs(t - lastSaved) >= 5) savePosition(t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
