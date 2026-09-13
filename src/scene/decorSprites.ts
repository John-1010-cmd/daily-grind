import doorLaceUrl from '../assets/decor/door_lace.webp';
import doorWreathUrl from '../assets/decor/door_wreath.webp';
import pastryCopperUrl from '../assets/decor/pastry_copper.webp';
import plantPothosUrl from '../assets/decor/plant_pothos.webp';
import plantSucculentUrl from '../assets/decor/plant_succulent.webp';
import shelfLadderUrl from '../assets/decor/shelf_ladder.webp';
import tableClothUrl from '../assets/decor/table_cloth.webp';
import tableIronUrl from '../assets/decor/table_iron.webp';
import seasideLanternUrl from '../assets/decor/seaside-lantern.webp';
import seasideShellsUrl from '../assets/decor/seaside-shells.webp';

export interface DecorSpritePlacement {
  x: number;
  y: number;
  width: number;
  /** sprite 锚点（默认 0.5/0.5 居中） */
  anchorX?: number;
  anchorY?: number;
  depthY?: number;
}

/** 变体 ID → 贴图（T3.8 批次 D）；默认款式（cost 0）无贴图，沿用底图烘焙家具 */
export const DECOR_SPRITE_URLS: Record<string, string> = {
  plant_pothos: plantPothosUrl,
  plant_succulent: plantSucculentUrl,
  door_lace: doorLaceUrl,
  door_wreath: doorWreathUrl,
  pastry_copper: pastryCopperUrl,
  table_cloth: tableClothUrl,
  table_iron: tableIronUrl,
  shelf_ladder: shelfLadderUrl,
  sea_shells: seasideShellsUrl,
  sea_lantern: seasideLanternUrl
};

/** 槽位 ID → 摆放位置（对齐 SCENE_OBJECTS 的物件中心，覆盖在底图烘焙家具之上） */
export const DECOR_SLOT_PLACEMENTS: Record<string, DecorSpritePlacement> = {
  // 落地窗顶悬挂绿萝 / 窗台多肉拼盘
  slot_window_plants: { x: 250, y: 110, width: 155, anchorY: 0, depthY: 330 },
  // 大门：蕾丝半帘（含门框，整门覆盖）/ 干花花环挂在门上部
  slot_door: { x: 92, y: 450, width: 105, depthY: 470 },
  // 糕点柜整柜覆盖
  slot_pastry: { x: 1170, y: 342, width: 120, depthY: 470 },
  // 餐桌整桌覆盖（略放大压住房底图桌脚）
  slot_table_1: { x: 430, y: 460, width: 190, depthY: 520 },
  slot_table_2: { x: 725, y: 520, width: 205, depthY: 585 },
  slot_table_3: { x: 1045, y: 575, width: 215, depthY: 650 },
  // 右侧书架整架覆盖
  slot_bookshelf: { x: 680, y: 255, width: 155, depthY: 335 },
  sea_slot_table_1: { x: 320, y: 448, width: 96 },
  sea_slot_table_3: { x: 218, y: 586, width: 80 }
};

/** 干花花环与多肉拼盘与槽位默认摆放不同：挂门上部 / 搁窗台上 */
export const DECOR_VARIANT_PLACEMENT_OVERRIDES: Record<string, DecorSpritePlacement> = {
  door_wreath: { x: 92, y: 395, width: 72, depthY: 470 },
  plant_succulent: { x: 295, y: 305, width: 115, depthY: 385 }
};
