import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  capturePageView,
  getAnalyticsConsent,
  isAnalyticsConfigured,
  setAnalyticsConsent
} from './posthog';

export function AnalyticsPageTracker() {
  const location = useLocation();
  const [consent, setConsent] = useState(getAnalyticsConsent);

  useEffect(() => {
    const handleConsentChange = () => setConsent(getAnalyticsConsent());
    window.addEventListener('pigeon-analytics-consent-changed', handleConsentChange);
    return () => window.removeEventListener('pigeon-analytics-consent-changed', handleConsentChange);
  }, []);

  useEffect(() => {
    if (consent === 'granted') capturePageView(location.pathname);
  }, [consent, location.pathname]);

  return null;
}

export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState(getAnalyticsConsent);

  useEffect(() => {
    const handleConsentChange = () => setConsent(getAnalyticsConsent());
    window.addEventListener('pigeon-analytics-consent-changed', handleConsentChange);
    return () => window.removeEventListener('pigeon-analytics-consent-changed', handleConsentChange);
  }, []);

  if (!isAnalyticsConfigured() || consent) return null;

  const choose = (value) => {
    setAnalyticsConsent(value);
    setConsent(value);
  };

  return (
    <aside className="analytics-consent" role="region" aria-label="Analytics consent">
      <strong className="analytics-consent__title">Help us improve <span translate="no">Pigeon</span></strong>
      <p className="analytics-consent__copy" id="analytics-consent-description">
        We use privacy-focused, anonymous analytics to understand which pages are useful.
        Analytics will not load unless you allow it.
      </p>
      <div className="analytics-consent__actions">
        <button
          className="analytics-consent__button analytics-consent__button--secondary"
          type="button"
          aria-describedby="analytics-consent-description"
          onClick={() => choose('denied')}
        >
          Decline
        </button>
        <button
          className="analytics-consent__button analytics-consent__button--primary"
          type="button"
          aria-describedby="analytics-consent-description"
          onClick={() => choose('granted')}
        >
          Allow Analytics
        </button>
      </div>
    </aside>
  );
}
