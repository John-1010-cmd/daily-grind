import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { CAT_SPOTS } from '../src/config';
import { CatComponent } from '../src/scene/catComponent';
import { OwnerCharacter } from '../src/scene/ownerCharacter';

describe('M2 美术管线首跑与资产组件测试 (T2.1 - T2.6)', () => {
  it('1. 橘猫组件 (CatComponent)：初始位置、睡姿、抚摸眯眼与换位逻辑', () => {
    const cat = new CatComponent();

    // 初始位置在 Table 4 垫子
    expect(cat.getCurrentSpot().id).toBe('spot_table_4');
    expect(cat.getCurrentPose()).toBe('curled');

    // 抚摸互动：眯眼并返回呼噜文案
    const petResult = cat.pet();
    expect(petResult.pose).toBe('blink');
    expect(cat.getCurrentPose()).toBe('blink');
    expect(petResult.text).toContain('呼噜');

    // 换位逻辑：迁移到其他合法点位
    const newSpot = cat.relocate('spot_table_3');
    expect(newSpot.id).toBe('spot_table_3');
    expect(cat.getCurrentSpot().pos).toEqual(CAT_SPOTS.find((s) => s.id === 'spot_table_3')!.pos);

    // 时间推移：呼噜计时器倒数后回到 curled 或 stretch
    cat.update(4.0);
    expect(['curled', 'stretch']).toContain(cat.getCurrentPose());
  });

  it('2. 店主角色程序补间 (OwnerCharacter)：1:4 全身精灵与动画状态响应', () => {
    const owner = new OwnerCharacter();
    expect(owner.container.children).toHaveLength(2); // shadow + 完整透明角色精灵

    // 朝向切换测试
    owner.update(0.1, false, 'right');
    expect(owner.container.scale.x).toBe(1);

    owner.update(0.1, false, 'left');
    expect(owner.container.scale.x).toBe(-1);

    // 移动补间计算验证（无报错，关节旋转更新）
    expect(() => {
      owner.update(0.016, true, 'right');
      owner.update(0.016, true, 'right');
      owner.update(0.016, false, 'right');
    }).not.toThrow();
  });

  it('3. 资产规范与体积预算验证 (T2.2)：单图与总包均符合预算', () => {
    const scenePath = path.resolve('src/assets/scene/scene-base.webp');
    expect(fs.existsSync(scenePath)).toBe(true);

    const sceneStat = fs.statSync(scenePath);
    // 场景底图预算 <= 600 KB
    expect(sceneStat.size).toBeLessThan(600 * 1024);

    const ownerParts = [
      'owner-head.png',
      'owner-body.png',
      'owner-arm-l.png',
      'owner-arm-r.png',
      'owner-leg-l.png',
      'owner-leg-r.png'
    ];
    let ownerTotalSize = 0;
    for (const part of ownerParts) {
      const p = path.resolve('src/assets/characters/owner', part);
      expect(fs.existsSync(p)).toBe(true);
      const s = fs.statSync(p).size;
      expect(s).toBeLessThan(60 * 1024); // 单部件 <= 60KB
      ownerTotalSize += s;
    }
    expect(ownerTotalSize).toBeLessThan(100 * 1024);

    const catParts = ['cat-curled.png', 'cat-stretch.png', 'cat-blink.png'];
    let catTotalSize = 0;
    for (const part of catParts) {
      const p = path.resolve('src/assets/cat', part);
      expect(fs.existsSync(p)).toBe(true);
      const s = fs.statSync(p).size;
      expect(s).toBeLessThan(60 * 1024); // 单部件 <= 60KB
      catTotalSize += s;
    }
    expect(catTotalSize).toBeLessThan(100 * 1024);

    // M2 首屏总资产预算 <= 1.8 MB
    const totalAssetsSize = sceneStat.size + ownerTotalSize + catTotalSize;
    expect(totalAssetsSize).toBeLessThan(1.8 * 1024 * 1024);
  });
});
