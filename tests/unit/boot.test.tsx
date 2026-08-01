import { forceCloseSplash } from '../../src/utils/boot';
import { vi, describe, it, expect } from 'vitest';

describe('boot splash logic', () => {
  it('fake-Tauri platform -> splash loader IS invoked', () => {
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: vi.fn() });
    const storage = { setItem: vi.fn() };
    
    forceCloseSplash('tauri', tauriLoader, storage);
    
    expect(tauriLoader).toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledWith('splash_status', 'ready');
  });

  it('web platform -> NO Tauri module load is attempted', () => {
    const tauriLoader = vi.fn();
    const storage = { setItem: vi.fn() };
    
    forceCloseSplash('web', tauriLoader, storage);
    
    expect(tauriLoader).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
