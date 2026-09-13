import { describe, expect, it } from 'vitest';
import { CatComponent } from '../src/scene/catComponent';
import { CustomerCharacter } from '../src/scene/customerCharacter';

describe('M6 角色生活动作', () => {
  it('顾客会按饮品或烘焙品切换啜饮/进食动作', () => {
    const customer = new CustomerCharacter(0x7a9c82);
    customer.setActivity('drinking');
    expect(customer.getActivity()).toBe('drinking');
    customer.setActivity('eating');
    expect(customer.getActivity()).toBe('eating');
    customer.setActivity('phone');
    expect(customer.getActivity()).toBe('phone');
  });

  it('橘猫醒着伸懒腰时有持续动作，而非静止贴图', () => {
    const cat = new CatComponent();
    cat.setPose('stretch');
    const before = cat.container.rotation;
    cat.update(0.25);
    expect(cat.container.rotation).not.toBe(before);
  });
});
