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
  slot_window_plants: { x: 230, y: 30, width: 210, anchorY: 0 },
  // 大门：蕾丝半帘（含门框，整门覆盖）/ 干花花环挂在门上部
  slot_door: { x: 512, y: 360, width: 125 },
  // 糕点柜整柜覆盖
  slot_pastry: { x: 852, y: 445, width: 135 },
  // 餐桌整桌覆盖（略放大压住房底图桌脚）
  slot_table_1: { x: 1175, y: 712, width: 215 },
  slot_table_2: { x: 1050, y: 625, width: 180 },
  slot_table_3: { x: 630, y: 500, width: 150 },
  // 右侧书架整架覆盖
  slot_bookshelf: { x: 1308, y: 355, width: 175 },
  sea_slot_table_1: { x: 320, y: 448, width: 96 },
  sea_slot_table_3: { x: 218, y: 586, width: 80 }
};

/** 干花花环与多肉拼盘与槽位默认摆放不同：挂门上部 / 搁窗台上 */
export const DECOR_VARIANT_PLACEMENT_OVERRIDES: Record<string, DecorSpritePlacement> = {
  door_wreath: { x: 512, y: 320, width: 95 },
  plant_succulent: { x: 230, y: 470, width: 190 }
};
