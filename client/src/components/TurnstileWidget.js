import { useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptPromise;

function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(window.turnstile));
            existingScript.addEventListener('error', reject);
            return;
        }

        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.turnstile);
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return scriptPromise;
}

export default function TurnstileWidget({ onToken, onError }) {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

    useEffect(() => {
        if (!siteKey || !containerRef.current) return undefined;
        let cancelled = false;

        loadTurnstileScript()
            .then((turnstile) => {
                if (cancelled || !turnstile || !containerRef.current) return;
                widgetIdRef.current = turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    theme: 'dark',
                    size: 'flexible',
                    callback: onToken,
                    'expired-callback': () => onToken(''),
                    'error-callback': () => onError('Security check failed. Please try again.')
                });
            })
            .catch(() => onError('Security check could not load. Please refresh and try again.'));

        return () => {
            cancelled = true;
            if (widgetIdRef.current !== null && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [onError, onToken, siteKey]);

    if (!siteKey) return null;
    return <div ref={containerRef} className="pigeon-turnstile" aria-label="Cloudflare security check" />;
}
