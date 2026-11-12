import { Character } from './character';
import { activeAt, type Seg } from './timeline';
import type { Episode, Who } from './types';

const STAGE_SIZE = 1000;
const WHOS: Who[] = ['ryopon', 'mui'];

type EmoteSeg = Seg & { who: Who; symbol: string };

/** 舞台。1000×1000 の固定座標で組み、表示サイズに合わせて拡縮する。 */
export class Stage {
  readonly el = document.createElement('div');
  onPoke?: (who: Who) => void;

  private readonly background = document.createElement('img');
  private readonly emoteEls = {} as Record<Who, HTMLDivElement>;
  private readonly emoteTracks = {} as Record<Who, EmoteSeg[]>;
  private readonly shownEmote: Partial<Record<Who, EmoteSeg>> = {};

  static async create(episode: Episode, base: URL): Promise<Stage> {
    const [ryopon, mui] = await Promise.all(WHOS.map((who) => Character.load(new URL(episode.characters[who], base))));
    return new Stage(episode, base, { ryopon, mui });
  }

  private constructor(
    private readonly episode: Episode,
    private readonly base: URL,
    private readonly chars: Record<Who, Character>,
  ) {
    this.el.className = 'stage';
    const inner = document.createElement('div');
    inner.className = 'stage-inner';
    this.background.className = 'stage-bg';
    this.background.alt = '';
    this.background.draggable = false;
    inner.append(this.background);

    for (const who of WHOS) {
      const char = chars[who];
      char.el.setAttribute('role', 'button');
      char.el.setAttribute('aria-label', who === 'ryopon' ? 'りょぽんをつつく' : 'むいちゃんをつつく');
      char.onPoke = () => this.onPoke?.(who);
      inner.append(char.el);

      const emote = document.createElement('div');
      emote.className = 'emote';
      emote.style.left = `${char.box.left + char.box.width * 0.78}px`;
      emote.style.top = `${char.box.top - 30}px`;
      this.emoteEls[who] = emote;
      this.emoteTracks[who] = (episode.tracks.emote ?? []).filter((seg) => seg.who === who);
      inner.append(emote);
    }
    this.el.append(inner);

    new ResizeObserver(([entry]) => {
      inner.style.transform = `scale(${entry.contentRect.width / STAGE_SIZE})`;
    }).observe(this.el);
  }

  render(t: number, now: number): void {
    const tracks = this.episode.tracks;

    const scene = activeAt(tracks.scene, t);
    const backgroundUrl = scene ? new URL(scene.background, this.base).href : '';
    if (this.background.dataset.url !== backgroundUrl) {
      this.background.dataset.url = backgroundUrl;
      if (backgroundUrl) this.background.src = backgroundUrl;
      this.background.hidden = !backgroundUrl;
    }

    this.chars.ryopon.render(
      {
        face: activeAt(tracks.ryoponFace, t)?.face ?? 'neutral',
        pose: activeAt(tracks.ryoponPose, t)?.pose ?? 'default',
        mouth: activeAt(tracks.ryoponMouth, t)?.shape ?? 'closed',
      },
      now,
    );
    this.chars.mui.render(
      {
        face: activeAt(tracks.muiFace, t)?.face ?? 'neutral',
        pose: activeAt(tracks.muiPose, t)?.pose ?? 'default',
        mouth: 'closed',
      },
      now,
    );

    for (const who of WHOS) {
      const seg = activeAt(this.emoteTracks[who], t);
      if (seg === this.shownEmote[who]) continue;
      this.shownEmote[who] = seg;
      const el = this.emoteEls[who];
      el.classList.remove('show');
      if (seg) {
        el.textContent = seg.symbol;
        void el.offsetWidth; // アニメーションを最初からやり直す
        el.classList.add('show');
      }
    }
  }
}
