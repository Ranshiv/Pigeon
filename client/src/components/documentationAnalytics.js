const ANALYTICS_KEY = 'pigeon-doc-analytics';
const PROGRESS_KEY = 'pigeon-doc-progress';

const readJson = (key, fallback) => {
    try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        return fallback;
    }
};

export const trackDocumentationEvent = (event, properties = {}) => {
    const record = { event, properties, timestamp: new Date().toISOString() };
    const events = [...readJson(ANALYTICS_KEY, []), record].slice(-500);
    try {
        window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
    } catch (error) {
        // Analytics must never prevent a guide from loading or being used.
    }
};

export const readDocumentationProgress = () => readJson(PROGRESS_KEY, {});

export const markDocumentationGuideComplete = (guideId) => {
    const progress = { ...readDocumentationProgress(), [guideId]: true };
    try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        window.dispatchEvent(new CustomEvent('pigeon-doc-progress', { detail: { guideId } }));
    } catch (error) {
        // Progress is an enhancement and should not block article reading.
    }
    trackDocumentationEvent('guide_completed', { guideId });
    return progress;
};

export const readDocumentationAnalytics = () => readJson(ANALYTICS_KEY, []);
