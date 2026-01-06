// client/src/components/compliance/download.js

function getApiBaseUrl() {
    const env = process.env.REACT_APP_API_BASE_URL;
    if (env && typeof env === 'string') return env.replace(/\/$/, '');

    // Dev default: CRA on :3000, API on :5001
    if (typeof window !== 'undefined') {
        const { hostname, port, protocol } = window.location;
        if (port === '3000') {
            return `${protocol}//${hostname}:5001`;
        }
    }

    // Production / same-origin deployments
    return '';
}

function filenameFromContentDisposition(headerValue) {
    if (!headerValue) return null;

    // Basic filename="..." parsing
    const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(headerValue);
    const raw = match?.[1] || match?.[2] || match?.[3];
    if (!raw) return null;

    try {
        return decodeURIComponent(raw.trim());
    } catch {
        return raw.trim();
    }
}

export async function downloadFromApi(pathWithQuery, fallbackFilename) {
    const base = getApiBaseUrl();
    const url = `${base}${pathWithQuery}`;

    const res = await fetch(url, {
        method: 'GET',
        credentials: 'include'
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get('content-disposition');
    const suggestedName = filenameFromContentDisposition(contentDisposition);
    const filename = suggestedName || fallbackFilename || 'download';

    const objectUrl = window.URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        window.URL.revokeObjectURL(objectUrl);
    }
}
