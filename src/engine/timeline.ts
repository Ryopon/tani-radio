export interface Seg {
  start: number;
  end: number;
}

/**
 * 時刻 t を含む区間を返す。区間は開始時刻の昇順で、重ならないこと。
 * 画面の状態はすべてこの関数で「再生位置から計算」するので、シークしても状態がずれない。
 */
export function activeAt<T extends Seg>(segs: readonly T[] | undefined, t: number): T | undefined {
  if (!segs) return undefined;
  let lo = 0;
  let hi = segs.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return undefined;
  return t < segs[found].end ? segs[found] : undefined;
}
