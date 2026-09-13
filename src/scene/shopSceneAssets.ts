import mainShellUrl from '../assets/scene/scene-main-shell.webp';
import seasideSceneUrl from '../assets/scene/scene-seaside.webp';
import catNookUrl from '../assets/scene/scene-cat-nook.webp';
import counterBaseUrl from '../assets/scene/scene-counter-base.webp';
import equipmentStationUrl from '../assets/scene/scene-equipment-station.webp';
import storageShelfUrl from '../assets/scene/scene-storage-shelf.webp';
import tableFourSeatUrl from '../assets/scene/scene-table-four-seat.webp';
import tableTwoSeatUrl from '../assets/scene/scene-table-two-seat.webp';
import { ShopId } from '../config';

export const SHOP_SCENE_BACKGROUND_URLS: Record<ShopId, string> = {
  main: mainShellUrl,
  seaside: seasideSceneUrl
};

/** 本店采用建筑壳体 + 独立物件的模块化 2.5D 场景；旧整图只保留作迁移期素材。 */
export const MAIN_SCENE_MODULE_URLS = {
  catNook: catNookUrl,
  counterBase: counterBaseUrl,
  equipmentStation: equipmentStationUrl,
  storageShelf: storageShelfUrl,
  tableTwoSeat: tableTwoSeatUrl,
  tableFourSeat: tableFourSeatUrl
} as const;
