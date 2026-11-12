import type { Seg } from './timeline';

export type Who = 'ryopon' | 'mui';
export type MouthShape = 'closed' | 'half' | 'open';

export interface ChapterItem {
  title: string;
  start: number;
}

export interface Chapter {
  id: string;
  title: string;
  start: number;
  items?: ChapterItem[];
}

export interface SubtitleSeg extends Seg {
  who: Who;
  text: string;
}

export interface CardSeg extends Seg {
  kind: string;
  title: string;
  body: string;
  image: string | null;
  source?: { name: string; url: string };
}

export interface Tracks {
  subtitle?: SubtitleSeg[];
  ryoponMouth?: (Seg & { shape: MouthShape })[];
  ryoponFace?: (Seg & { face: string })[];
  ryoponPose?: (Seg & { pose: string })[];
  muiFace?: (Seg & { face: string })[];
  muiPose?: (Seg & { pose: string })[];
  emote?: (Seg & { who: Who; symbol: string })[];
  scene?: (Seg & { background: string })[];
  card?: CardSeg[];
}

export interface Episode {
  schema: number;
  date: string;
  title: string;
  duration: number;
  audio: string;
  characters: Record<Who, string>;
  chapters: Chapter[];
  tracks: Tracks;
  sources?: { title: string; name: string; url: string }[];
  credits?: string[];
}

/** レイヤーにかける変形。単位はリグの元サイズでのピクセルと度。 */
export interface LayerPose {
  image?: string;
  rotate?: number;
  scale?: [number, number];
  translate?: [number, number];
}

export interface Rig {
  width: number;
  height: number;
  /** 舞台（1000×1000）上の配置。cx は中心の x、bottom は足元の y。 */
  stage: { cx: number; bottom: number; height: number };
  /** 下から順に重ねる。全レイヤーの画像はキャンバス全体と同じサイズで書き出す。 */
  layers: { id: string; image?: string; origin?: [number, number] }[];
  /** 表情名 → レイヤーID → 画像 */
  faces: Record<string, Record<string, string>>;
  talk?: { layer: string; half: string; open: string };
  blink?: { layer: string; image: string; faces?: string[] };
  /** ポーズ名 → レイヤーID（全体は "_root"）→ 変形 */
  poses: Record<string, Record<string, LayerPose>>;
  poke?: { faces: string[] };
}
