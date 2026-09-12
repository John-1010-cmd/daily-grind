import americanoUrl from '../assets/drinks/americano.png';
import cappuccinoUrl from '../assets/drinks/cappuccino.png';
import croissantUrl from '../assets/drinks/croissant.png';
import espressoUrl from '../assets/drinks/espresso.png';
import jasmineTeaUrl from '../assets/drinks/jasmine_tea.png';
import latteUrl from '../assets/drinks/latte.png';
import matchaLatteUrl from '../assets/drinks/matcha_latte.png';
import peachOolongUrl from '../assets/drinks/peach_oolong.png';
import tiramisuUrl from '../assets/drinks/tiramisu.png';

/** 配方 ID → 饮品图标（T3.8 批次 A） */
export const DRINK_ICON_URLS: Record<string, string> = {
  espresso: espressoUrl,
  americano: americanoUrl,
  latte: latteUrl,
  cappuccino: cappuccinoUrl,
  jasmine_tea: jasmineTeaUrl,
  matcha_latte: matchaLatteUrl,
  peach_oolong: peachOolongUrl,
  croissant: croissantUrl,
  tiramisu: tiramisuUrl
};

export function drinkIconHtml(recipeId: string, fallbackEmoji: string, size = 40): string {
  const url = DRINK_ICON_URLS[recipeId];
  if (!url) return fallbackEmoji;
  return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;" />`;
}
