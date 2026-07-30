import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType
} from 'react-router-dom';

const environment = process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const enabled = Boolean(process.env.REACT_APP_SENTRY_DSN) &&
  process.env.NODE_ENV === 'production' &&
  environment === 'production';

const SENSITIVE_KEY = /(authorization|cookie|set-cookie|api[-_ ]?key|x[-_]api[-_]key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|\btoken\b|password|passwd|secret|credential|private[-_ ]?key|session[-_ ]?id|x[-_]auth|client[-_ ]?secret|signature)/i;

function scrubObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubObject);

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[Filtered]' : scrubObject(item)
  ]));
}

function scrubEvent(event) {
  if (!event) return event;
  const serialized = JSON.stringify(event);
  if (serialized && /ResizeObserver loop/i.test(serialized)) return null;

  if (event.request) {
    const request = { ...event.request };
    if (request.headers) request.headers = scrubObject(request.headers);
    if (request.data) request.data = '[Filtered]';
    if (request.cookies) request.cookies = '[Filtered]';
    if (request.query) request.query = scrubObject(request.query);
    event.request = request;
  }
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) event.contexts = scrubObject(event.contexts);
  return event;
}

export function initializeSentry() {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    enabled,
    environment,
    release: process.env.REACT_APP_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      })
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: [
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded'
    ],
    beforeSend: scrubEvent
  });
}

export function setSentryUser(user) {
  if (!user || !user.id) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: String(user.id),
    ...(user.email ? { email: user.email } : {})
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry, scrubEvent };
