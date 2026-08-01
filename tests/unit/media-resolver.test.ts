import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('mediaUrl', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.resetModules();
    (global as any).window = {};
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK' });
  });

  afterEach(() => {
    delete (global as any).window;
    global.fetch = originalFetch;
  });

  it('web platform -> uses CDN', async () => {
    const { mediaUrl } = await import('../../src/media-resolver');
    expect(mediaUrl('video.mp4')).toBe('https://media.ehacademy.com/video.mp4');
  });

  it('web platform subtitles -> uses /subtitles/', async () => {
    const { mediaUrl } = await import('../../src/media-resolver');
    expect(mediaUrl('/subtitles/sub.vtt')).toBe('/subtitles/sub.vtt');
  });

  it('tauri platform -> uses asset protocol', async () => {
    (global.window as any).__TAURI_INTERNALS__ = true;
    const { mediaUrl } = await import('../../src/media-resolver');
    expect(mediaUrl('video.mp4')).toBe('http://media.localhost/video.mp4');
  });

  it('tauri platform subtitles -> uses asset protocol', async () => {
    (global.window as any).__TAURI_INTERNALS__ = true;
    const { mediaUrl } = await import('../../src/media-resolver');
    expect(mediaUrl('subtitles/sub.vtt')).toBe('http://media.localhost/subtitles/sub.vtt');
  });

  it('special characters -> correctly encodes', async () => {
    const { mediaUrl } = await import('../../src/media-resolver');
    expect(mediaUrl('my video #1.mp4')).toBe('https://media.ehacademy.com/my%20video%20%231.mp4');
  });
});
