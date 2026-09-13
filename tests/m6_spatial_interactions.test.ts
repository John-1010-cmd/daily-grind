import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CAT_SPOTS,
  MAIN_2P5D_COLLISION_FOOTPRINTS,
  MAIN_2P5D_MODULES,
  MAIN_2P5D_TABLE_SEATS,
  MAIN_2P5D_WALKABLE_ZONES
} from '../src/config';
import { sceneDepthForY } from '../src/scene/depth';
import { isPointNavigable } from '../src/scene/nav';

describe('M6 空间与操作反馈回归', () => {
  it('猫在猫窝上方渲染，不被猫窝柜体吞没', () => {
    const nook = MAIN_2P5D_MODULES.static.find((item) => item.id === 'cat_nook')!;
    expect(sceneDepthForY(CAT_SPOTS[0].pos.y, CAT_SPOTS[0].renderDepthOffset)).toBeGreaterThan(
      sceneDepthForY(nook.y, nook.depthOffset)
    );
  });

  it('家具脚印不可行走，角色不会走进餐桌', () => {
    const table = MAIN_2P5D_MODULES.tableSlots[0];
    expect(isPointNavigable(
      { x: table.x, y: table.y },
      MAIN_2P5D_WALKABLE_ZONES,
      MAIN_2P5D_COLLISION_FOOTPRINTS
    )).toBe(false);
  });

  it('顾客座位声明坐姿渲染语义', () => {
    expect(MAIN_2P5D_TABLE_SEATS.every((seat) => 'pose' in seat && seat.pose === 'sitting')).toBe(true);
  });

  it('咖啡设备接触线落在吧台台面而非前板', () => {
    const equipment = MAIN_2P5D_MODULES.static.find((item) => item.id === 'equipment_station')!;
    expect(equipment.y).toBeLessThanOrEqual(320);
  });

  it('本店具有独立街景层', () => {
    expect(fs.existsSync('src/assets/scene/scene-main-exterior.webp')).toBe(true);
  });
});
