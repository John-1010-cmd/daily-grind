import catBlinkUrl from './cat/cat-blink.png';
import catCurledUrl from './cat/cat-curled.png';
import catStretchUrl from './cat/cat-stretch.png';
import doorLaceUrl from './decor/door_lace.webp';
import doorWreathUrl from './decor/door_wreath.webp';
import pastryCopperUrl from './decor/pastry_copper.webp';
import plantPothosUrl from './decor/plant_pothos.webp';
import plantSucculentUrl from './decor/plant_succulent.webp';
import shelfLadderUrl from './decor/shelf_ladder.webp';
import tableClothUrl from './decor/table_cloth.webp';
import tableIronUrl from './decor/table_iron.webp';
import seasideLanternUrl from './decor/seaside-lantern.webp';
import seasideShellsUrl from './decor/seaside-shells.webp';
import sceneSeasideUrl from './scene/scene-seaside.webp';
import mainExteriorUrl from './scene/scene-main-exterior.webp';
import counterBaseUrl from './scene/scene-counter-base.webp';
import equipmentStationUrl from './scene/scene-equipment-station.webp';
import storageShelfUrl from './scene/scene-storage-shelf.webp';
import catNookUrl from './scene/scene-cat-nook.webp';
import tableTwoSeatUrl from './scene/scene-table-two-seat.webp';
import tableFourSeatUrl from './scene/scene-table-four-seat.webp';
import ownerOneByFourUrl from './scene/owner-1x4.webp';
import customerOneByFourUrl from './scene/customer-1x4.webp';
import customerSeatedOneByFourUrl from './scene/customer-seated-1x4.webp';

/** Pixi v8 不再替 Texture.from(url) 隐式加载；创建场景前统一预热所有 Pixi 位图。 */
export const CORE_PIXI_ASSETS = [
  sceneSeasideUrl,
  mainExteriorUrl,
  counterBaseUrl,
  equipmentStationUrl,
  storageShelfUrl,
  catNookUrl,
  tableTwoSeatUrl,
  tableFourSeatUrl,
  ownerOneByFourUrl,
  customerOneByFourUrl,
  customerSeatedOneByFourUrl,
  catBlinkUrl,
  catCurledUrl,
  catStretchUrl,
  doorLaceUrl,
  doorWreathUrl,
  pastryCopperUrl,
  plantPothosUrl,
  plantSucculentUrl,
  shelfLadderUrl,
  tableClothUrl,
  tableIronUrl,
  seasideLanternUrl,
  seasideShellsUrl
] as const;
