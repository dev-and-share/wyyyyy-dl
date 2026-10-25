import { describe, it, expect } from 'vitest';
import { calculateTapeRadii } from './cassetteHelper';

describe('cassetteHelper calculateTapeRadii', () => {
  it('at progress 0, left roll is full and right roll is minimum', () => {
    const { left, right } = calculateTapeRadii(0, 14, 36);
    expect(left).toBe(36);
    expect(right).toBe(14);
  });

  it('at progress 1, left roll is minimum and right roll is full', () => {
    const { left, right } = calculateTapeRadii(1, 14, 36);
    expect(left).toBe(14);
    expect(right).toBe(36);
  });

  it('at progress 0.5, both rolls are midway', () => {
    const { left, right } = calculateTapeRadii(0.5, 14, 36);
    expect(left).toBe(25);
    expect(right).toBe(25);
  });

  it('clamps out-of-range or NaN progress safely', () => {
    const negative = calculateTapeRadii(-0.5, 14, 36);
    expect(negative.left).toBe(36);
    expect(negative.right).toBe(14);

    const overflow = calculateTapeRadii(1.5, 14, 36);
    expect(overflow.left).toBe(14);
    expect(overflow.right).toBe(36);

    const nanVal = calculateTapeRadii(NaN, 14, 36);
    expect(nanVal.left).toBe(36);
    expect(nanVal.right).toBe(14);
  });
});
