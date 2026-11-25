// Track colors: the reference categorical palette's dark-surface steps (validated set),
// in fixed order, because poses are drawn over video, which is usually dark. Never cycled:
// tracks past the eighth share one neutral "other" gray, and every animal also carries a
// direct name label, so identity never rests on color alone.
export const TRACK_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
export const OTHER_COLOR = '#9a9a96';

export function trackColor(slot: number): string {
  return TRACK_COLORS[slot] ?? OTHER_COLOR;
}
