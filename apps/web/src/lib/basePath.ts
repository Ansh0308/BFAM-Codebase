// The path the portal is served under ("/portal" in production, empty in development).
// Next's <Link> and router add it on their own; a plain <img src> or a full-page
// navigation does not, so those go through withBasePath().
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
