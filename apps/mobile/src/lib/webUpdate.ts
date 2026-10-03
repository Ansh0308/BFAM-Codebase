// "A new version is available": the website is a single-page app, so a tab (or an
// installed home-screen copy) that stays open keeps running the version it loaded - which
// is why testers kept reporting problems that had already been fixed. Each published build
// carries an id, baked into the code (EXPO_PUBLIC_BUILD_ID) and written to /version.json;
// the app compares the two and offers a reload when they differ.

// Read when needed (not at import) so tests can set it; Expo inlines the literal at build time.
export function getBuildId(): string | undefined {
  return process.env.EXPO_PUBLIC_BUILD_ID || undefined;
}

// True when the server's build is different from the one this page is running. Unknown
// on either side (local development, or an old build with no id) is never "newer".
export function isNewerBuild(running: string | undefined, published: string | null | undefined) {
  return Boolean(running && published && running !== published);
}

export async function fetchPublishedBuildId(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === 'string' && body.id ? body.id : null;
  } catch {
    return null;
  }
}
