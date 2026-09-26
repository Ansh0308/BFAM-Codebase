// Environment guards shared by the security-sensitive bits of the app.
//
// "Local" means an explicit NODE_ENV of `development` or `test` — nothing
// else. An unset or unexpected value (staging, production, a typo, a host
// that forgot to set it) is treated as a real deployment, so anything that
// is only safe on a developer's machine fails CLOSED instead of open.
export function isLocalDevOrTest(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test';
}

// How many reverse proxies sit in front of this server (Caddy, an Azure or
// Railway load balancer...). Behind a proxy every request arrives from the
// proxy's address, so without this the login/register rate limiters see one
// client for ALL users; with it Express trusts X-Forwarded-For for that many
// hops. It is opt-in (TRUST_PROXY=1) rather than always-on because trusting
// the header when nothing strips it lets any client spoof its IP and dodge
// the limiter. Accepts a hop count or an Express trust-proxy value such as
// "loopback"; blank/0/false means "don't trust".
export function getTrustProxySetting(): number | string | false {
  const raw = (process.env.TRUST_PROXY ?? '').trim();
  if (!raw || raw === '0' || raw.toLowerCase() === 'false') return false;
  // "true" would trust every hop and so every spoofed header; treat it as one
  // hop, which is what a single reverse proxy needs.
  if (raw.toLowerCase() === 'true') return 1;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

// Browsers may call this API only from the origins listed in CORS_ORIGIN, a
// comma-separated allowlist ("https://app.example.com,https://admin.example.com").
// Both the REST API (cors) and Socket.IO use it. Entries are trimmed and a
// trailing slash is dropped, because a browser's Origin header never has one.
// Unset means "any origin" (`true`), which is fine on a developer's machine;
// a deployment should always set it. The mobile apps are not browsers and are
// not subject to CORS, so this does not affect them.
export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
  const origins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}
