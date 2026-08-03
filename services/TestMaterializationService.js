const findRequestForTestCase = (collection, testCase) => {
    const requests = collection?.requests;
    if (!requests) return null;

    const artifactId = String(testCase?.materialization?.artifactId || '');
    if (artifactId && typeof requests.id === 'function') {
        const request = requests.id(artifactId);
        if (request) return request;
    }

    const caseId = String(testCase?._id || '');
    if (!caseId) return null;
    return Array.from(requests).find((request) => String(request?.metadata?.generatedTestCaseId || '') === caseId) || null;
};

const enabledVariables = (items = []) => Object.fromEntries(
    (Array.isArray(items) ? items : [])
        .filter((item) => item?.enabled !== false && item?.key)
        .map((item) => [String(item.key), item.value])
);

const buildRuntimeVariables = (collection, environment) => ({
    ...enabledVariables(collection?.variables),
    ...enabledVariables(environment?.variables)
});

const unresolvedVariableKeys = (value, variables = {}) => {
    const missing = new Set();
    String(value || '').replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
        const name = String(key).trim();
        if (variables[name] === undefined || variables[name] === null || variables[name] === '') missing.add(name);
        return _match;
    });
    return [...missing];
};

module.exports = { findRequestForTestCase, buildRuntimeVariables, unresolvedVariableKeys };
