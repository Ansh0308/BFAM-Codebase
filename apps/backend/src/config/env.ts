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
