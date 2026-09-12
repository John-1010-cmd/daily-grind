import { EQUIPMENT_LEVELS, EquipmentLevelDef } from '../config';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';

export class EquipmentManager {
  private saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  public getLevel(): number {
    return this.saveManager.getState().equipmentLevel;
  }

  public getCurrentDef(): EquipmentLevelDef {
    const level = this.getLevel();
    return EQUIPMENT_LEVELS.find((e) => e.level === level) ?? EQUIPMENT_LEVELS[0];
  }

  public getNextDef(): EquipmentLevelDef | null {
    const level = this.getLevel();
    return EQUIPMENT_LEVELS.find((e) => e.level === level + 1) ?? null;
  }

  public getBrewSpeedMultiplier(): number {
    return this.getCurrentDef().brewSpeedMultiplier;
  }

  public getBrewSlots(): number {
    return this.getCurrentDef().brewSlots;
  }

  public canUpgrade(gold: number): { ok: boolean; reason?: string } {
    const next = this.getNextDef();
    if (!next) {
      return { ok: false, reason: '设备已是最高级别' };
    }
    if (gold < next.upgradeCost) {
      return { ok: false, reason: `金币不足（需 🪙${next.upgradeCost}）` };
    }
    return { ok: true };
  }

  public upgrade(ledger: EconomyLedger): boolean {
    const next = this.getNextDef();
    if (!next) return false;
    const check = this.canUpgrade(ledger.getBalance());
    if (!check.ok) return false;

    ledger.settleEquipmentUpgrade(next.label, next.upgradeCost);
    this.saveManager.updateState((draft) => {
      draft.equipmentLevel = next.level;
    });
    return true;
  }
}
