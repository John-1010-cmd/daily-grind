import {
  FURNITURE_EXPANSION_CONFIG,
  ShopId,
  TableSeatDef
} from '../config';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';

export interface FurnitureActionResult {
  ok: boolean;
  reason?: string;
}

/**
 * 固定扩建槽位的唯一领域入口。永久拥有与当前摆放分离，隐藏存放不会扣费或降级。
 */
export class FurnitureManager {
  constructor(
    private readonly saveManager: SaveManager,
    private readonly ledger: EconomyLedger
  ) {}

  public getTableLevels(shopId: ShopId): Readonly<Record<string, number>> {
    return this.saveManager.getState().world.shops[shopId].furniture.tableLevels;
  }

  public getCounterLevel(shopId: ShopId): number {
    return this.saveManager.getState().world.shops[shopId].furniture.counterLevel;
  }

  public getOwnedTableLevel(shopId: ShopId, slotId: string): number {
    const owned = this.saveManager.getState().world.shops[shopId].furniture.ownedUpgrades;
    return FURNITURE_EXPANSION_CONFIG.table.reduce(
      (max, level) => owned.includes(`table:${slotId}:${level.level}`) ? Math.max(max, level.level) : max,
      0
    );
  }

  public getOwnedCounterLevel(shopId: ShopId): number {
    const owned = this.saveManager.getState().world.shops[shopId].furniture.ownedUpgrades;
    return FURNITURE_EXPANSION_CONFIG.counter.reduce(
      (max, level) => owned.includes(`counter:${level.level}`) ? Math.max(max, level.level) : max,
      0
    );
  }

  public upgradeTable(shopId: ShopId, slotId: string): FurnitureActionResult {
    const ownedLevel = this.getOwnedTableLevel(shopId, slotId);
    const next = FURNITURE_EXPANSION_CONFIG.table.find((item) => item.level === ownedLevel + 1);
    if (!next) return { ok: false, reason: '这张桌子已经布置到最舒适的样子啦。' };
    if (this.ledger.getBalance() < next.cost) {
      return { ok: false, reason: FURNITURE_EXPANSION_CONFIG.insufficientGoldCopy };
    }
    this.ledger.settleFurniturePurchase(`${slotId} · ${next.name}`, next.cost);
    this.saveManager.updateState((draft) => {
      const state = draft.world.shops[shopId].furniture;
      state.ownedUpgrades.push(`table:${slotId}:${next.level}`);
      state.tableLevels[slotId] = next.level;
    });
    return { ok: true };
  }

  public setTableLevel(shopId: ShopId, slotId: string, level: number): FurnitureActionResult {
    const ownedLevel = this.getOwnedTableLevel(shopId, slotId);
    if (level < 0 || level > ownedLevel) return { ok: false, reason: '这个款式还没有置办。' };
    this.saveManager.updateState((draft) => {
      draft.world.shops[shopId].furniture.tableLevels[slotId] = level;
    });
    return { ok: true };
  }

  public upgradeCounter(shopId: ShopId): FurnitureActionResult {
    const ownedLevel = this.getOwnedCounterLevel(shopId);
    const next = FURNITURE_EXPANSION_CONFIG.counter.find((item) => item.level === ownedLevel + 1);
    if (!next) return { ok: false, reason: '吧台已经是完整配置啦。' };
    if (this.ledger.getBalance() < next.cost) {
      return { ok: false, reason: FURNITURE_EXPANSION_CONFIG.insufficientGoldCopy };
    }
    this.ledger.settleFurniturePurchase(next.name, next.cost);
    this.saveManager.updateState((draft) => {
      const state = draft.world.shops[shopId].furniture;
      state.ownedUpgrades.push(`counter:${next.level}`);
      state.counterLevel = next.level;
    });
    return { ok: true };
  }

  public getActiveSeats(shopId: ShopId, seats: readonly TableSeatDef[]): readonly TableSeatDef[] {
    const levels = this.getTableLevels(shopId);
    return seats.filter((seat) => {
      const capacity = FURNITURE_EXPANSION_CONFIG.table[levels[seat.tableId] ?? 0]?.seats ?? 0;
      const seatIndex = seats.filter((item) => item.tableId === seat.tableId).findIndex((item) => item.id === seat.id);
      return seatIndex >= 0 && seatIndex < capacity;
    });
  }
}
