import { describe, expect, it, vi } from 'vitest';
import { BaristaModal } from '../src/ui/baristaModal';

describe('M6 玩家吧台操作界面', () => {
  it('玩家确认后才开始制作，并展示无失败态的四步操作反馈', () => {
    const root = document.createElement('div');
    const onStart = vi.fn();
    const modal = new BaristaModal(root);

    modal.open({ recipeName: '拿铁', onStart });

    expect(onStart).not.toHaveBeenCalled();
    expect(root.querySelectorAll('[data-barista-step]')).toHaveLength(4);
    expect(root.textContent).not.toContain('失败');

    (root.querySelector('[data-barista-start]') as HTMLButtonElement).click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-barista-panel]')?.classList.contains('is-working')).toBe(true);

    modal.updateProgress(0.7);
    expect(root.querySelectorAll('[data-barista-step].is-done')).toHaveLength(2);
    expect(root.querySelectorAll('[data-barista-step].is-active')).toHaveLength(1);
  });

  it('制作开始前可安静收起，开始后任务锁定且完成反馈自动出现', () => {
    const root = document.createElement('div');
    const modal = new BaristaModal(root);
    modal.open({ recipeName: '浓缩', onStart: () => undefined });
    (root.querySelector('[data-barista-close]') as HTMLButtonElement).click();
    expect(modal.isOpen()).toBe(false);

    modal.open({ recipeName: '浓缩', onStart: () => undefined });
    (root.querySelector('[data-barista-start]') as HTMLButtonElement).click();
    expect(root.querySelector('[data-barista-close]')).toBeNull();
    modal.complete();
    expect(root.textContent).toContain('稳稳出杯');
  });
});
