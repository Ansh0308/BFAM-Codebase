import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
    console.log('Sentry tracking initialized successfully');
  } else {
    console.log('Sentry DSN not provided; Sentry tracking is disabled');
  }
}
