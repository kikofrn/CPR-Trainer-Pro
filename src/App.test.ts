import { describe, expect, it, vi } from 'vitest';
import { syncPresenterSubtitle } from './App';

describe('presenter subtitle synchronization', () => {
  it('clears the viewer subtitle when captions are toggled off', () => {
    const sender = vi.fn().mockResolvedValue(true);

    syncPresenterSubtitle(
      true,
      false,
      { text: 'Continue CPR until help arrives.' },
      sender,
    );

    expect(sender).toHaveBeenCalledOnce();
    expect(sender).toHaveBeenCalledWith('presentation:subtitle', { text: '' });
  });

  it('does not emit when Presenter is inactive', () => {
    const sender = vi.fn().mockResolvedValue(true);

    syncPresenterSubtitle(false, true, { text: 'Visible cue' }, sender);

    expect(sender).not.toHaveBeenCalled();
  });
});
