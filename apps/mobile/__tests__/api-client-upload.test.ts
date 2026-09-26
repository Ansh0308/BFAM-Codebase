import { BFAMApiClient } from '@bfam/api-client';

// Regression: on the mobile-web build, profile-photo uploads sent the text
// "[object Object]" instead of the image, because the {uri, name, type} file
// shortcut only exists in React Native's networking layer. The browser needs a
// real Blob, fetched from the picked file's blob:/data: URI.

const originalProduct = Object.getOwnPropertyDescriptor(globalThis.navigator, 'product');
const originalFetch = globalThis.fetch;

function setNavigatorProduct(value: string) {
  Object.defineProperty(globalThis.navigator, 'product', { value, configurable: true });
}

afterEach(() => {
  if (originalProduct) Object.defineProperty(globalThis.navigator, 'product', originalProduct);
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('BFAMApiClient.uploadProfilePhoto', () => {
  it('on the web, uploads the picked image as a real file under the "photo" field', async () => {
    setNavigatorProduct('Gecko');
    const pickedBlob = new Blob(['abcd'], { type: 'image/png' });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => pickedBlob }) // reading the blob: URI
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile_photo_url: 'https://x/y.png' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new BFAMApiClient('https://api.example.com');
    const result = await client.uploadProfilePhoto('blob:https://site/abc', 'image/png');

    expect(result.profile_photo_url).toBe('https://x/y.png');
    expect(fetchMock.mock.calls[0][0]).toBe('blob:https://site/abc');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/profile/photo');
    const body = fetchMock.mock.calls[1][1].body as FormData;
    const photo = body.get('photo') as File;
    expect(photo).toBeInstanceOf(Blob);
    expect(photo.name).toBe('photo.png');
    expect(photo.type).toBe('image/png');
    expect(photo.size).toBe(4);
  });

  it('on a phone, keeps using the {uri, name, type} file shape and fetches nothing extra', async () => {
    setNavigatorProduct('ReactNative');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile_photo_url: 'https://x/y.jpg' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const append = jest.spyOn(FormData.prototype, 'append');

    const client = new BFAMApiClient('https://api.example.com');
    await client.uploadProfilePhoto('file:///data/user/0/photo.jpg', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const photoCall = append.mock.calls.find((c) => c[0] === 'photo');
    expect(photoCall?.[1]).toEqual({
      uri: 'file:///data/user/0/photo.jpg',
      name: 'photo.jpeg',
      type: 'image/jpeg',
    });
  });
});
