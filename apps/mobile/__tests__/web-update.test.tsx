import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchPublishedBuildId, isNewerBuild } from '../src/lib/webUpdate';
import { UpdateBanner } from '../src/components/UpdateBanner';

// Testers kept reporting problems that were already fixed because a tab left open keeps
// running the version it loaded. A published build has an id; the running site compares
// it with /version.json and offers a reload.

describe('isNewerBuild', () => {
  it('is true only when both ids are known and different', () => {
    expect(isNewerBuild('abc-1', 'abc-2')).toBe(true);
    expect(isNewerBuild('abc-1', 'abc-1')).toBe(false);
    expect(isNewerBuild(undefined, 'abc-2')).toBe(false); // local development
    expect(isNewerBuild('abc-1', null)).toBe(false); // no version.json yet
  });
});

describe('fetchPublishedBuildId', () => {
  it('reads the id from version.json without using the cache', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'abc-2' }) });
    expect(await fetchPublishedBuildId(fetcher as unknown as typeof fetch)).toBe('abc-2');
    expect(fetcher.mock.calls[0][0]).toMatch(/^\/version\.json\?t=\d+$/);
    expect(fetcher.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('gives null when the file is missing, malformed or the network fails', async () => {
    const f = (impl: unknown) => impl as unknown as typeof fetch;
    expect(await fetchPublishedBuildId(f(jest.fn().mockResolvedValue({ ok: false })))).toBeNull();
    expect(
      await fetchPublishedBuildId(
        f(jest.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) })),
      ),
    ).toBeNull();
    expect(
      await fetchPublishedBuildId(f(jest.fn().mockRejectedValue(new Error('offline')))),
    ).toBeNull();
  });
});

describe('UpdateBanner', () => {
  const originalFetch = globalThis.fetch;
  const originalReload = window.location;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, 'location', { value: originalReload, configurable: true });
    jest.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_BUILD_ID;
  });

  async function renderBanner(running: string | undefined, published: string | null) {
    jest.replaceProperty(Platform, 'OS', 'web');
    if (running) process.env.EXPO_PUBLIC_BUILD_ID = running;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: published !== null,
      json: async () => ({ id: published }),
    }) as unknown as typeof fetch;
    const utils = await render(<UpdateBanner />);
    await act(async () => {
      await Promise.resolve();
    });
    return utils;
  }

  it('offers a reload when a newer build has been published, and reloads on tap', async () => {
    const reload = jest.fn();
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
    const { findByTestId } = await renderBanner('abc-1', 'abc-2');

    const banner = await findByTestId('update-banner');
    await fireEvent.press(banner);
    expect(reload).toHaveBeenCalled();
  });

  it('stays hidden when this is already the latest build', async () => {
    const { queryByTestId } = await renderBanner('abc-1', 'abc-1');
    expect(queryByTestId('update-banner')).toBeNull();
  });

  it('stays hidden without a build id (local development)', async () => {
    const { queryByTestId } = await renderBanner(undefined, 'abc-2');
    expect(queryByTestId('update-banner')).toBeNull();
  });
});
