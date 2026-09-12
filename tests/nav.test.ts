import { describe, expect, it } from 'vitest';
import {
  NAV_EDGES,
  NAV_WAYPOINTS,
  SCENE_OBJECTS,
  WALKABLE_ZONES
} from '../src/config';
import {
  NavGraph,
  clampToWalkable,
  distance,
  findHitObject,
  isLineWalkable,
  isPointInWalkable
} from '../src/scene/nav';

describe('Navigation Graph & Click Rules (T0.4 & T0.5)', () => {
  const navGraph = new NavGraph(NAV_WAYPOINTS, NAV_EDGES);

  it('1. 导航图基本结构：所有路径点与边均有效连通', () => {
    const allWp = navGraph.getAllWaypoints();
    expect(allWp.length).toBe(NAV_WAYPOINTS.length);

    // Any waypoint can route to another waypoint across the cafe
    const path = navGraph.findPathBetweenWaypoints('door_exit', 'table1_front');
    expect(path.length).toBeGreaterThan(1);
    expect(path[0].id).toBe('door_exit');
    expect(path[path.length - 1].id).toBe('table1_front');
  });

  it('2. 寻路不穿墙：门到餐桌沿预设连通路径点行进', () => {
    const from = { x: 520, y: 550 }; // door
    const to = { x: 1060, y: 710 }; // table 1
    const route = navGraph.route(from, to);

    expect(route.length).toBeGreaterThan(0);
    // Last point must be the target destination
    const last = route[route.length - 1];
    expect(last.x).toBe(to.x);
    expect(last.y).toBe(to.y);
  });

  it('3. 可行走区域判断与边界吸附', () => {
    // 门前通道应在可行走区内
    expect(isPointInWalkable({ x: 520, y: 550 })).toBe(true);

    // 墙外或天花板位置不属于可行走区
    expect(isPointInWalkable({ x: 100, y: 100 })).toBe(false);

    // 点击在非可行走区时，吸附到最近的有效位置
    const outside = { x: 50, y: 50 };
    const clamped = clampToWalkable(outside);
    expect(isPointInWalkable(clamped)).toBe(true);
  });

  it('4. 点击规则第 1 节：点击对象优先于空地移动', () => {
    // 橘猫的坐标 (390, 620)，hitbox 涵盖 (360, 600, 170, 110)
    const catClick = { x: 420, y: 640 };
    const hitObj = findHitObject(catClick);
    expect(hitObj).not.toBeNull();
    expect(hitObj?.id).toBe('cat_cushion');

    // 糕点柜在吧台左侧 (780, 380, 120, 120)
    const pastryClick = { x: 850, y: 450 };
    const hitPastry = findHitObject(pastryClick);
    expect(hitPastry).not.toBeNull();
    expect(hitPastry?.id).toBe('pastry_case');

    // 吧台右段 (1100, 450)
    const barClick = { x: 1100, y: 450 };
    const hitBar = findHitObject(barClick);
    expect(hitBar).not.toBeNull();
    expect(hitBar?.id).toBe('counter');

    // 空地走道点击不命中任何对象
    const groundClick = { x: 700, y: 650 };
    const hitNothing = findHitObject(groundClick);
    expect(hitNothing).toBeNull();
  });

  it('5. 点击不可达 / 被遮挡对象时，目标点为对象的 interactPoint', () => {
    // 咖啡机在吧台上不可直接踩上去，其 interactPoint 为 (920, 590)
    const espressoMachine = SCENE_OBJECTS.find((o) => o.id === 'espresso_machine');
    expect(espressoMachine).toBeDefined();
    expect(espressoMachine!.interactPoint).toEqual({ x: 920, y: 590 });

    // 验证其 interactPoint 位于走道附近可行走区域
    expect(isPointInWalkable(espressoMachine!.interactPoint)).toBe(true);
  });

  it('6. 热区设计防误触：每个可交互对象的 hitbox 大于等于其视觉矩形', () => {
    for (const obj of SCENE_OBJECTS) {
      expect(obj.hitbox.width).toBeGreaterThanOrEqual(obj.width);
      expect(obj.hitbox.height).toBeGreaterThanOrEqual(obj.height);
      expect(obj.hitbox.x).toBeLessThanOrEqual(obj.x);
      expect(obj.hitbox.y).toBeLessThanOrEqual(obj.y);
    }
  });
});
