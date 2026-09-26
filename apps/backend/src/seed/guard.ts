// The phase1 and demo seeds create fake players and accounts whose passwords
// are written in the repo. Running one against a real (production) database
// would hand anyone an admin login, so they refuse unless explicitly forced.
export function refuseDemoSeedInProduction(seedName: string): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error(
      `Refusing to run ${seedName} with NODE_ENV=production: it creates accounts with well-known ` +
        'passwords. Use `npm run db:seed:beta` instead (or set ALLOW_DEMO_SEED=true if you really mean it).',
    );
    process.exit(1);
  }
}
