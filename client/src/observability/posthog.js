const CONSENT_STORAGE_KEY = 'pigeon.analytics-consent.v1';
const configuredKey = process.env.REACT_APP_POSTHOG_KEY;
const configuredHost = process.env.REACT_APP_POSTHOG_HOST || 'https://eu.i.posthog.com';
const configuredUiHost = process.env.REACT_APP_POSTHOG_UI_HOST || 'https://eu.posthog.com';
const enabled = Boolean(configuredKey) && (
  process.env.NODE_ENV === 'production' || process.env.REACT_APP_POSTHOG_ENABLED === 'true'
);

let posthogClient = null;
let initializationPromise = null;

export function isAnalyticsConfigured() {
  return enabled;
}

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export async function initializePostHog() {
  if (!enabled || getAnalyticsConsent() !== 'granted' || typeof window === 'undefined') return null;
  if (posthogClient) return posthogClient;
  if (initializationPromise) return initializationPromise;

  // Defer the third-party SDK until the visitor has opted in.
  initializationPromise = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(configuredKey, {
      api_host: configuredHost,
      ui_host: configuredUiHost,
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true
    });
    posthogClient = posthog;
    return posthog;
  }).catch((error) => {
    initializationPromise = null;
    if (process.env.NODE_ENV !== 'production') console.warn('PostHog initialization failed:', error);
    return null;
  });

  return initializationPromise;
}

export function setAnalyticsConsent(consent) {
  if (consent !== 'granted' && consent !== 'denied') return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Storage failure leaves analytics effectively disabled.
  }

  if (consent === 'granted') initializePostHog();
  if (consent === 'denied' && posthogClient) {
    posthogClient.opt_out_capturing();
    posthogClient.reset();
  }
  window.dispatchEvent(new Event('pigeon-analytics-consent-changed'));
}

export async function capturePageView(pathname) {
  const posthog = await initializePostHog();
  if (!posthog || !pathname || typeof window === 'undefined') return;
  posthog.capture('$pageview', {
    path: pathname,
    $current_url: `${window.location.origin}${pathname}`
  });
}

export function captureAnalyticsEvent(eventName, properties = {}) {
  if (!posthogClient || getAnalyticsConsent() !== 'granted') return;
  posthogClient.capture(eventName, properties);
}

export { CONSENT_STORAGE_KEY };
