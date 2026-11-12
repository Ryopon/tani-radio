import type { LayerPose, MouthShape, Rig } from './types';

export interface CharacterState {
  face: string;
  pose: string;
  mouth: MouthShape;
}

function toTransform(pose: LayerPose | undefined): string {
  if (!pose) return '';
  const parts: string[] = [];
  if (pose.translate) parts.push(`translate(${pose.translate[0]}px, ${pose.translate[1]}px)`);
  if (pose.rotate) parts.push(`rotate(${pose.rotate}deg)`);
  if (pose.scale) parts.push(`scale(${pose.scale[0]}, ${pose.scale[1]})`);
  return parts.join(' ');
}

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

/** パーツを重ねて表示するキャラクター。表情・ポーズ・口の形を受け取り、まばたきとつつきは自前で動かす。 */
export class Character {
  readonly el = document.createElement('div');
  /** 舞台上の位置（舞台座標）。記号演出の配置に使う。 */
  readonly box: { left: number; top: number; width: number; height: number };
  onPoke?: () => void;

  private readonly poseRoot = document.createElement('div');
  private readonly bump = document.createElement('div');
  private readonly layers = new Map<string, HTMLImageElement>();
  private lastKey = '';
  private lastFace = '';
  private lastPose = '';
  private nextBlink = 0;
  private blinkEnd = 0;
  private pokeUntil = 0;
  private pokeFace = '';

  static async load(base: URL): Promise<Character> {
    const rig = (await (await fetch(new URL('rig.json', base))).json()) as Rig;
    const images = new Set<string>();
    for (const layer of rig.layers) if (layer.image) images.add(layer.image);
    for (const face of Object.values(rig.faces)) for (const image of Object.values(face)) images.add(image);
    for (const pose of Object.values(rig.poses)) for (const layer of Object.values(pose)) if (layer.image) images.add(layer.image);
    if (rig.talk) images.add(rig.talk.half).add(rig.talk.open);
    if (rig.blink) images.add(rig.blink.image);
    await Promise.all([...images].map((image) => preload(new URL(image, base).href)));
    return new Character(rig, base);
  }

  private constructor(
    private readonly rig: Rig,
    private readonly base: URL,
  ) {
    const scale = rig.stage.height / rig.height;
    const width = rig.width * scale;
    this.box = { left: rig.stage.cx - width / 2, top: rig.stage.bottom - rig.stage.height, width, height: rig.stage.height };

    this.el.className = 'char';
    Object.assign(this.el.style, {
      left: `${this.box.left}px`,
      top: `${this.box.top}px`,
      width: `${this.box.width}px`,
      height: `${this.box.height}px`,
    });

    // 入れ子の順: 位置 > 元サイズへの拡縮 > 呼吸 > ポーズ全体の変形 > 切り替え時の弾み > レイヤー
    const native = document.createElement('div');
    native.className = 'char-native';
    Object.assign(native.style, { width: `${rig.width}px`, height: `${rig.height}px`, transform: `scale(${scale})` });
    const breath = document.createElement('div');
    breath.className = 'char-breath';
    this.poseRoot.className = 'char-pose';
    this.bump.className = 'char-bump';

    for (const layer of rig.layers) {
      const img = document.createElement('img');
      img.className = 'char-layer';
      img.alt = '';
      img.draggable = false;
      if (layer.origin) img.style.transformOrigin = `${layer.origin[0] * 100}% ${layer.origin[1] * 100}%`;
      this.layers.set(layer.id, img);
      this.bump.append(img);
    }
    this.poseRoot.append(this.bump);
    breath.append(this.poseRoot);
    native.append(breath);
    this.el.append(native);

    this.el.addEventListener('click', () => this.poke());
  }

  /** つつかれたときの反応。番組の状態は変えず、少しの間だけ表情を上書きする。 */
  poke(): void {
    const faces = this.rig.poke?.faces ?? [];
    if (faces.length > 0) {
      this.pokeFace = faces[Math.floor(Math.random() * faces.length)];
      this.pokeUntil = performance.now() + 800;
    }
    this.bump.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-7%) scale(1.03, 0.97)' }, { transform: 'translateY(0)' }],
      { duration: 380, easing: 'ease-out' },
    );
    this.onPoke?.();
  }

  render(state: CharacterState, now: number): void {
    const rig = this.rig;
    const face = now < this.pokeUntil ? this.pokeFace : state.face;

    if (now >= this.nextBlink) {
      if (this.nextBlink > 0) this.blinkEnd = now + 130;
      this.nextBlink = now + 2000 + Math.random() * 4000;
    }
    const blink = !!rig.blink && now < this.blinkEnd && (!rig.blink.faces || rig.blink.faces.includes(face));

    const key = `${face}|${state.pose}|${state.mouth}|${blink}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const pose = rig.poses[state.pose] ?? {};
    const faceImages = rig.faces[face] ?? rig.faces.neutral ?? {};

    for (const layer of rig.layers) {
      let image = pose[layer.id]?.image ?? faceImages[layer.id] ?? layer.image;
      if (rig.talk && layer.id === rig.talk.layer && state.mouth !== 'closed') image = rig.talk[state.mouth];
      if (blink && rig.blink && layer.id === rig.blink.layer) image = rig.blink.image;

      const img = this.layers.get(layer.id)!;
      const url = image ? new URL(image, this.base).href : '';
      if (img.dataset.url !== url) {
        img.dataset.url = url;
        if (url) img.src = url;
        img.hidden = !url;
      }
      img.style.transform = toTransform(pose[layer.id]);
    }
    this.poseRoot.style.transform = toTransform(pose._root);

    // 表情かポーズが変わった瞬間だけ、小さく弾ませる。
    if (this.lastFace && (face !== this.lastFace || state.pose !== this.lastPose)) {
      this.bump.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05, 0.95)' }, { transform: 'scale(1)' }], {
        duration: 200,
        easing: 'ease-out',
      });
    }
    this.lastFace = face;
    this.lastPose = state.pose;
  }
}
