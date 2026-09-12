import catBlinkUrl from './cat/cat-blink.png';
import catCurledUrl from './cat/cat-curled.png';
import catStretchUrl from './cat/cat-stretch.png';
import ownerArmLUrl from './characters/owner/owner-arm-l.png';
import ownerArmRUrl from './characters/owner/owner-arm-r.png';
import ownerBodyUrl from './characters/owner/owner-body.png';
import ownerHeadUrl from './characters/owner/owner-head.png';
import ownerLegLUrl from './characters/owner/owner-leg-l.png';
import ownerLegRUrl from './characters/owner/owner-leg-r.png';
import passengerArmLUrl from './characters/passenger/passenger-arm-l.png';
import passengerArmRUrl from './characters/passenger/passenger-arm-r.png';
import passengerBodyUrl from './characters/passenger/passenger-body.png';
import passengerHeadUrl from './characters/passenger/passenger-head.png';
import passengerLegLUrl from './characters/passenger/passenger-leg-l.png';
import passengerLegRUrl from './characters/passenger/passenger-leg-r.png';
import doorLaceUrl from './decor/door_lace.webp';
import doorWreathUrl from './decor/door_wreath.webp';
import pastryCopperUrl from './decor/pastry_copper.webp';
import plantPothosUrl from './decor/plant_pothos.webp';
import plantSucculentUrl from './decor/plant_succulent.webp';
import shelfLadderUrl from './decor/shelf_ladder.webp';
import tableClothUrl from './decor/table_cloth.webp';
import tableIronUrl from './decor/table_iron.webp';
import sceneBaseUrl from './scene/scene-base.webp';

/** Pixi v8 不再替 Texture.from(url) 隐式加载；创建场景前统一预热所有 Pixi 位图。 */
export const CORE_PIXI_ASSETS = [
  sceneBaseUrl,
  catBlinkUrl,
  catCurledUrl,
  catStretchUrl,
  ownerArmLUrl,
  ownerArmRUrl,
  ownerBodyUrl,
  ownerHeadUrl,
  ownerLegLUrl,
  ownerLegRUrl,
  passengerArmLUrl,
  passengerArmRUrl,
  passengerBodyUrl,
  passengerHeadUrl,
  passengerLegLUrl,
  passengerLegRUrl,
  doorLaceUrl,
  doorWreathUrl,
  pastryCopperUrl,
  plantPothosUrl,
  plantSucculentUrl,
  shelfLadderUrl,
  tableClothUrl,
  tableIronUrl
] as const;
