import iconDecorUrl from '../assets/ui/icon_decor.png';
import iconFundUrl from '../assets/ui/icon_fund.png';
import iconHandbookUrl from '../assets/ui/icon_handbook.png';
import iconMapUrl from '../assets/ui/icon_map.png';
import iconRecipesUrl from '../assets/ui/icon_recipes.png';
import iconSettingsUrl from '../assets/ui/icon_settings.png';
import iconStaffUrl from '../assets/ui/icon_staff.png';
import iconSupplyUrl from '../assets/ui/icon_supply.png';

/** HUD 顶部按钮 ID → 水彩图标（T3.8 批次 E），与 UI_CONFIG.TOP_NAV_BUTTONS 一一对应 */
export const HUD_ICON_URLS: Record<string, string> = {
  recipes: iconRecipesUrl,
  supply: iconSupplyUrl,
  decor: iconDecorUrl,
  handbook: iconHandbookUrl,
  staff: iconStaffUrl,
  map: iconMapUrl,
  fund: iconFundUrl,
  settings: iconSettingsUrl
};

export function hudIconHtml(buttonId: string, fallbackEmoji: string, size = 26): string {
  const url = HUD_ICON_URLS[buttonId];
  if (!url) return fallbackEmoji;
  return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;" />`;
}
