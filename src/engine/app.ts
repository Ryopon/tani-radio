import { Stage } from './stage';
import { activeAt } from './timeline';
import type { CardSeg, Episode, SubtitleSeg } from './types';

interface Jump {
  id: string;
  title: string;
  start: number;
  level: 0 | 1;
}

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

const SPEAKER = { ryopon: 'りょぽん', mui: 'むい' } as const;

export async function startApp(root: HTMLElement, episode: Episode, base: URL): Promise<void> {
  const duration = episode.duration;
  const audio = new Audio(new URL(episode.audio, base).href);
  audio.preload = 'auto';
  const stage = await Stage.create(episode, base);

  const jumps: Jump[] = episode.chapters.flatMap((chapter) => [
    { id: chapter.id, title: chapter.title, start: chapter.start, level: 0 as const },
    ...(chapter.items ?? []).map((item, i) => ({ id: `${chapter.id}-${i + 1}`, title: item.title, start: item.start, level: 1 as const })),
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

  // ---------- 舞台 ----------
  const stageWrap = h('div', 'stage-wrap');
  const subtitle = h('div', 'subtitle', '', { 'aria-live': 'off' });
  subtitle.hidden = true;
  stageWrap.append(stage.el, subtitle);

  // ---------- 情報欄 ----------
  const panel = h('div', 'panel');
  const header = h('header', 'head');
  header.append(h('p', 'date', episode.date), h('h1', 'title', episode.title));

  const controls = h('div', 'controls');
  const back = h('button', 'btn', '−10', { type: 'button', 'aria-label': '10秒戻る' });
  const play = h('button', 'btn btn-play', '▶', { type: 'button', 'aria-label': '再生' });
  const forward = h('button', 'btn', '+10', { type: 'button', 'aria-label': '10秒進む' });
  const time = h('span', 'time', `0:00 / ${formatTime(duration)}`);
  const speed = h('select', 'speed', '', { 'aria-label': '再生速度' });
  for (const rate of [1, 1.25, 1.5, 2]) speed.append(h('option', '', `${rate}×`, { value: String(rate) }));
  const subtitleToggle = h('button', 'btn btn-toggle', '字幕', { type: 'button', 'aria-pressed': 'true' });
  const volume = h('input', 'volume', '', { type: 'range', min: '0', max: '1', step: '0.05', value: '1', 'aria-label': '音量' });
  controls.append(back, play, forward, time, speed, subtitleToggle, volume);

  const seekWrap = h('div', 'seek-wrap');
  const seek = h('input', 'seek', '', { type: 'range', min: '0', max: String(duration), step: '0.1', value: '0', 'aria-label': '再生位置' });
  const ticks = h('div', 'ticks');
  for (const chapter of episode.chapters.slice(1)) {
    const tick = h('span', 'tick');
    tick.style.left = `${(chapter.start / duration) * 100}%`;
    ticks.append(tick);
  }
  seekWrap.append(seek, ticks);

  const card = h('section', 'card');
  card.hidden = true;

  const chapterNav = h('nav', 'chapters', '', { 'aria-label': '目次' });
  const jumpButtons = jumps.map((jump) => {
    const button = h('button', `chapter level-${jump.level}`, '', { type: 'button' });
    button.append(h('span', 'chapter-title', jump.title), h('span', 'chapter-time', formatTime(jump.start)));
    button.addEventListener('click', () => {
      seekTo(jump.start);
      history.replaceState(null, '', `#${jump.id}`);
      void audio.play().catch(() => {});
    });
    chapterNav.append(button);
    return button;
  });

  const transcript = h('details', 'transcript');
  transcript.append(h('summary', '', '台本の全文'));
  let chapterIndex = 0;
  for (const seg of episode.tracks.subtitle ?? []) {
    while (chapterIndex < episode.chapters.length && episode.chapters[chapterIndex].start <= seg.start) {
      transcript.append(h('h3', '', episode.chapters[chapterIndex].title));
      chapterIndex++;
    }
    const line = h('button', `line who-${seg.who}`, `${SPEAKER[seg.who]}：${seg.text}`, { type: 'button' });
    line.addEventListener('click', () => seekTo(seg.start));
    transcript.append(line);
  }

  const footer = h('footer', 'foot');
  if (episode.sources?.length) {
    footer.append(h('h2', '', '出典'));
    const list = h('ul');
    for (const source of episode.sources) {
      const item = h('li');
      const url = safeUrl(source.url);
      if (url) item.append(h('a', '', `${source.title}（${source.name}）`, { href: url, target: '_blank', rel: 'noopener noreferrer' }));
      else item.textContent = `${source.title}（${source.name}）`;
      list.append(item);
    }
    footer.append(list);
  }
  if (episode.credits?.length) {
    footer.append(h('h2', '', 'クレジット'));
    const list = h('ul');
    for (const credit of episode.credits) list.append(h('li', '', credit));
    footer.append(list);
  }

  panel.append(header, controls, seekWrap, card, chapterNav, transcript, footer);

  // ---------- 開始画面（自動再生制限のため、ボタンを押してから音を出す） ----------
  const overlay = h('div', 'start');
  const startButton = h('button', 'start-btn', '番組をはじめる', { type: 'button' });
  overlay.append(h('p', 'start-date', episode.date), h('p', 'start-title', episode.title), startButton);
  const begin = (at: number): void => {
    overlay.remove();
    subtitle.hidden = false;
    seekTo(at);
    void audio.play().catch(() => {});
  };
  const hashJump = jumps.find((jump) => `#${jump.id}` === location.hash);
  startButton.addEventListener('click', () => begin(hashJump?.start ?? 0));
  const resumeAt = loadPosition();
  if (resumeAt > 0 && !hashJump) {
    const resume = h('button', 'start-btn start-btn-sub', `続きから（${formatTime(resumeAt)}）`, { type: 'button' });
    resume.addEventListener('click', () => begin(resumeAt));
    overlay.append(resume);
  }
  stageWrap.append(overlay);

  root.className = 'app';
  root.replaceChildren(stageWrap, panel);

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
  speed.addEventListener('change', () => (audio.playbackRate = Number(speed.value)));
  volume.addEventListener('input', () => (audio.volume = Number(volume.value)));
  let subtitlesOn = true;
  subtitleToggle.addEventListener('click', () => {
    subtitlesOn = !subtitlesOn;
    subtitleToggle.setAttribute('aria-pressed', String(subtitlesOn));
  });

  document.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).closest('input, select, button, a, summary')) return;
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
  let shownJump = -1;
  let shownSecond = -1;
  let shownPaused: boolean | undefined;

  function renderCard(seg: CardSeg | undefined): void {
    card.hidden = !seg;
    if (!seg) return;
    card.replaceChildren(h('h2', 'card-title', seg.title), h('p', 'card-body', seg.body));
    if (seg.image) {
      const img = h('img', 'card-image', '', { alt: '' });
      img.src = new URL(seg.image, base).href;
      card.append(img);
    }
    const url = seg.source && safeUrl(seg.source.url);
    if (seg.source && url) {
      card.append(h('a', 'card-source', `出典: ${seg.source.name}`, { href: url, target: '_blank', rel: 'noopener noreferrer' }));
    }
  }

  function frame(): void {
    const t = audio.currentTime;
    stage.render(t, performance.now());

    const sub = subtitlesOn ? activeAt(episode.tracks.subtitle, t) : undefined;
    if (sub !== shownSubtitle) {
      shownSubtitle = sub;
      subtitle.textContent = sub?.text ?? '';
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
      jumpButtons.forEach((button, i) => button.classList.toggle('current', i === jumpIndex));
    }

    if (Math.abs(Number(seek.value) - t) > 0.05) seek.value = String(t);
    const second = Math.floor(t);
    if (second !== shownSecond) {
      shownSecond = second;
      time.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
      seek.style.setProperty('--progress', `${(t / duration) * 100}%`);
    }
    if (audio.paused !== shownPaused) {
      shownPaused = audio.paused;
      play.textContent = audio.paused ? '▶' : '⏸';
      play.setAttribute('aria-label', audio.paused ? '再生' : '一時停止');
    }
    if (Math.abs(t - lastSaved) >= 5) savePosition(t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
