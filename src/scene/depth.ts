import { MAIN_2P5D_MODULES } from '../config';

/** 单一深度规则：同一世界层内，脚底越靠近镜头（Y 越大）越靠前。 */
export function sceneDepthForY(y: number, offset = 0): number {
  return MAIN_2P5D_MODULES.depthBase + y + offset;
}
