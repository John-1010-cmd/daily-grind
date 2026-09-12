import mainSceneUrl from '../assets/scene/scene-base.webp';
import seasideSceneUrl from '../assets/scene/scene-seaside.webp';
import { ShopId } from '../config';

export const SHOP_SCENE_BACKGROUND_URLS: Record<ShopId, string> = {
  main: mainSceneUrl,
  seaside: seasideSceneUrl
};
