import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Service Worker Audio Stream & Range Pass-Through Contracts (sw.js)', () => {
  const swPath = path.resolve(__dirname, '../../../src/main/resources/static/sw.js');
  const swSource = fs.readFileSync(swPath, 'utf-8');

  let fetchListener: ((event: any) => void) | null = null;
  let messageListener: ((event: any) => void) | null = null;
  let mockOnline = true;
  let mockCachedReqs: Array<{ url: string }> = [];
  let mockCacheMatch: ReturnType<typeof vi.fn>;

  function bootServiceWorker() {
    fetchListener = null;
    messageListener = null;
    mockCacheMatch = vi.fn();

    const mockCache = {
      keys: vi.fn().mockImplementation(async () => mockCachedReqs),
      match: mockCacheMatch,
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true)
    };

    const swGlobal: any = {
      location: new URL('http://localhost:8080'),
      navigator: {
        get onLine() {
          return mockOnline;
        }
      },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(true)
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
      addEventListener: vi.fn((type: string, cb: any) => {
        if (type === 'fetch') fetchListener = cb;
        if (type === 'message') messageListener = cb;
      }),
      Headers,
      Response,
      URL
    };
    swGlobal.self = swGlobal;

    const fn = new Function('self', 'caches', 'location', 'Headers', 'Response', 'URL', swSource);
    fn(swGlobal, swGlobal.caches, swGlobal.location, Headers, Response, URL);
  }

  beforeEach(() => {
    mockOnline = true;
    mockCachedReqs = [{ url: 'http://localhost:8080/v3/stream?id=100' }];
    bootServiceWorker();
  });

  it('never indexes bare u.pathname (/v3/stream) in syncAudioCacheIndex', () => {
    expect(swSource).not.toContain('newKeys.add(u.pathname)');
    expect(swSource).toContain('newKeys.add(u.pathname + u.search)');
  });

  it('passes through 100% of audio stream requests when online (never intercepts Range or initial GET)', async () => {
    mockOnline = true;
    // Let syncAudioCacheIndex resolve
    await Promise.resolve();
    await Promise.resolve();

    const urls = [
      'http://localhost:8080/v3/stream?id=100',
      'http://localhost:8080/v3/stream?id=200',
      'http://localhost:8080/v3/stream/online?id=300',
      'http://localhost:8080/v3/history/stream?path=test.mp3'
    ];

    for (const url of urls) {
      const respondWith = vi.fn();
      fetchListener!({
        request: {
          method: 'GET',
          url,
          headers: new Headers({ Range: 'bytes=65536-' })
        },
        respondWith
      });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it('does not intercept uncached song IDs when offline (prevents false-positive hijack across /v3/stream)', async () => {
    mockOnline = false;
    await Promise.resolve();
    await Promise.resolve();

    // Song 100 is cached, but Song 999 is NOT cached
    const respondWithUncached = vi.fn();
    fetchListener!({
      request: {
        method: 'GET',
        url: 'http://localhost:8080/v3/stream?id=999',
        headers: new Headers({ Range: 'bytes=0-' })
      },
      respondWith: respondWithUncached
    });
    expect(respondWithUncached).not.toHaveBeenCalled();
  });

  it('serves zero-copy Blob.slice 206 Partial Content for cached songs when offline', async () => {
    mockOnline = false;
    await Promise.resolve();
    await Promise.resolve();

    const fullBytes = new Uint8Array(1000);
    for (let i = 0; i < 1000; i++) fullBytes[i] = i % 256;
    const audioBlob = new Blob([fullBytes], { type: 'audio/mpeg' });

    mockCacheMatch.mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'audio/mpeg' }),
      blob: async () => audioBlob
    });

    let capturedPromise: Promise<Response> | null = null;
    fetchListener!({
      request: {
        method: 'GET',
        url: 'http://localhost:8080/v3/stream?id=100',
        headers: new Headers({ Range: 'bytes=100-499' })
      },
      respondWith: (p: Promise<Response>) => {
        capturedPromise = p;
      }
    });

    expect(capturedPromise).not.toBeNull();
    const res = await capturedPromise!;
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 100-499/1000');
    expect(res.headers.get('Content-Length')).toBe('400');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
  });
});
