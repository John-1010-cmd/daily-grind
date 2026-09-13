import { describe, expect, it } from 'vitest';
import { FURNITURE_EXPANSION_CONFIG, MAIN_2P5D_TABLE_SEATS } from '../src/config';
import { EconomyLedger } from '../src/economy';
import { FurnitureManager } from '../src/furniture';
import { MemoryStorageAdapter, SaveManager, validateAndSanitizeSave } from '../src/save';
import { sceneDepthForY } from '../src/scene/depth';

function setup() {
  const save = new SaveManager(new MemoryStorageAdapter());
  const ledger = new EconomyLedger(save);
  return { save, ledger, furniture: new FurnitureManager(save, ledger) };
}

describe('M6 2.5D 场景与固定扩建槽位', () => {
  it('同一世界层严格按脚底 Y 排序', () => {
    expect(sceneDepthForY(620)).toBeGreaterThan(sceneDepthForY(480));
    expect(sceneDepthForY(480, 20)).toBe(sceneDepthForY(500));
  });

  it('双人桌到四人桌会把有效并发座位从 2 提升到 4', () => {
    const { furniture } = setup();
    const initial = furniture.getActiveSeats('main', MAIN_2P5D_TABLE_SEATS)
      .filter((seat) => seat.tableId === 'table_1');
    expect(initial).toHaveLength(2);

    const context = setup();
    context.save.setGold(FURNITURE_EXPANSION_CONFIG.table[2].cost);
    expect(context.furniture.upgradeTable('main', 'table_1').ok).toBe(true);
    const upgraded = context.furniture.getActiveSeats('main', MAIN_2P5D_TABLE_SEATS)
      .filter((seat) => seat.tableId === 'table_1');
    expect(upgraded).toHaveLength(4);
  });

  it('金币不足只返回温柔提示，不扣钱也不改变家具', () => {
    const { save, furniture } = setup();
    save.setGold(0);
    const before = save.getState().world.shops.main.furniture.tableLevels.table_1;
    const result = furniture.upgradeTable('main', 'table_1');
    expect(result).toEqual({ ok: false, reason: FURNITURE_EXPANSION_CONFIG.insufficientGoldCopy });
    expect(save.getState().gold).toBe(0);
    expect(save.getState().world.shops.main.furniture.tableLevels.table_1).toBe(before);
  });

  it('已拥有桌子可免费收起和摆回，所有权永久保留', () => {
    const { save, furniture } = setup();
    const gold = save.getState().gold;
    expect(furniture.setTableLevel('main', 'table_1', 0).ok).toBe(true);
    expect(furniture.getActiveSeats('main', MAIN_2P5D_TABLE_SEATS).some((seat) => seat.tableId === 'table_1')).toBe(false);
    expect(furniture.setTableLevel('main', 'table_1', 1).ok).toBe(true);
    expect(save.getState().gold).toBe(gold);
    expect(furniture.getOwnedTableLevel('main', 'table_1')).toBe(1);
  });

  it('旧 v2 存档缺失家具字段时自动补齐每店默认状态', () => {
    const raw = structuredClone(setup().save.getState()) as unknown as Record<string, unknown>;
    const world = raw.world as { shops: Record<string, Record<string, unknown>> };
    delete world.shops.main.furniture;
    delete world.shops.seaside.furniture;
    const result = validateAndSanitizeSave(raw);
    expect(result.data.world.shops.main.furniture.tableLevels.table_1).toBe(1);
    expect(result.data.world.shops.seaside.furniture.tableLevels.table_4).toBe(1);
  });
});
