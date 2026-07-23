export function getApiBaseUrl() {
  const configured = process.env.REACT_APP_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }
  return '';
}

export function getGoogleAuthUrl() {
  return `${getApiBaseUrl()}/auth/google`;
}
