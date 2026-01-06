// client/src/components/marketplace/MarketplaceApi.js

async function jsonOrThrow(res) {
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
        const message = (data && data.message) ? data.message : `Request failed (${res.status})`;
        const err = new Error(message);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export const MarketplaceApi = {
    async listCategories() {
        const res = await fetch('/api/api-marketplace/categories', { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async listTags(query = '') {
        const res = await fetch(`/api/api-marketplace/tags?query=${encodeURIComponent(query)}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async browseListings({ query = '', category = '', tag = '', showcased = false, page = 1, limit = 20 } = {}) {
        const url = new URL('/api/api-marketplace/listings', window.location.origin);
        if (query) url.searchParams.set('query', query);
        if (category) url.searchParams.set('category', category);
        if (tag) url.searchParams.set('tag', tag);
        if (showcased) url.searchParams.set('showcased', 'true');
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(limit));
        const res = await fetch(url.toString(), { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getListing(listingId) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getReviews(listingId, { page = 1, limit = 20 } = {}) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/reviews?page=${page}&limit=${limit}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async submitReview(listingId, payload) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        return jsonOrThrow(res);
    },
    async getExamples(listingId) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/examples`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getGuides(listingId) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/guides`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getHealth(listingId, { windowDays = 7, limit = 30 } = {}) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/health?windowDays=${windowDays}&limit=${limit}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getPlans(listingId) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/plans`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async listThreads(listingId, { page = 1, limit = 20 } = {}) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/forums/threads?page=${page}&limit=${limit}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async getThread(threadId) {
        const res = await fetch(`/api/api-marketplace/forums/threads/${threadId}`, { credentials: 'include' });
        return jsonOrThrow(res);
    },
    async createThread(listingId, payload) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/forums/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        return jsonOrThrow(res);
    },
    async createPost(threadId, payload) {
        const res = await fetch(`/api/api-marketplace/forums/threads/${threadId}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        return jsonOrThrow(res);
    },
    async createListing(payload) {
        const res = await fetch('/api/api-marketplace/listings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        return jsonOrThrow(res);
    },
    async publishListing(listingId) {
        const res = await fetch(`/api/api-marketplace/listings/${listingId}/publish`, {
            method: 'POST',
            credentials: 'include'
        });
        return jsonOrThrow(res);
    }
};
