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
