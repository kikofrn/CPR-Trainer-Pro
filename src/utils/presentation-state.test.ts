import { describe, it, expect } from 'vitest';
import { isPresentationActive } from './presentation-state';

describe('isPresentationActive', () => {
  it('check-completes-while-presenting -> held (returns true)', () => {
    expect(isPresentationActive('video', 0, null, null)).toBe(true);
    expect(isPresentationActive('manual', null, { id: 1 }, null)).toBe(true);
    expect(isPresentationActive('slideshow', null, null, 2)).toBe(true);
  });

  it('exit-presentation -> shown / check-completes-at-menu -> immediate (returns false)', () => {
    expect(isPresentationActive('video', null, null, null)).toBe(false);
    expect(isPresentationActive('manual', null, null, null)).toBe(false);
    expect(isPresentationActive('slideshow', null, null, null)).toBe(false);
  });
});
