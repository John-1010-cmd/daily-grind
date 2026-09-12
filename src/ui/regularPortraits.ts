import akaiUrl from '../assets/regulars/regular_akai.png';
import laozhouUrl from '../assets/regulars/regular_laozhou.png';
import linwanUrl from '../assets/regulars/regular_linwan.png';
import susuUrl from '../assets/regulars/regular_susu.png';
import xiaoyaUrl from '../assets/regulars/regular_xiaoya.png';

/** 常客 ID → 头像（T3.8 批次 B） */
export const REGULAR_PORTRAIT_URLS: Record<string, string> = {
  regular_linwan: linwanUrl,
  regular_laozhou: laozhouUrl,
  regular_susu: susuUrl,
  regular_akai: akaiUrl,
  regular_xiaoya: xiaoyaUrl
};

export function regularPortraitUrl(regularId: string): string | undefined {
  return REGULAR_PORTRAIT_URLS[regularId];
}

export function regularPortraitHtml(regularId: string, fallbackEmoji: string, size = 64): string {
  const url = REGULAR_PORTRAIT_URLS[regularId];
  if (!url) return fallbackEmoji;
  return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;" />`;
}
