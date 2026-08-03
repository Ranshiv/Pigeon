const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const { findRequestForTestCase, buildRuntimeVariables, unresolvedVariableKeys } = require('../services/TestMaterializationService');

describe('test materialization request lookup', () => {
    const ownerId = new mongoose.Types.ObjectId();
    const caseId = new mongoose.Types.ObjectId();

    test('finds a request by its current artifact id', () => {
        const collection = new Collection({
            name: 'Generated tests', userId: ownerId, owner: ownerId,
            requests: [{ _id: 'req-generated', name: 'Case', method: 'GET', url: 'https://example.com' }]
        });
        expect(findRequestForTestCase(collection, { _id: caseId, materialization: { artifactId: 'req-generated' } })?.name).toBe('Case');
    });

    test('recovers an orphaned artifact reference from generated-case metadata', () => {
        const requestId = new mongoose.Types.ObjectId();
        const collection = new Collection({
            name: 'Generated tests', userId: ownerId, owner: ownerId,
            requests: [{ _id: requestId, name: 'Recovered case', method: 'GET', url: 'https://example.com', metadata: { generatedTestCaseId: String(caseId) } }]
        });
        const recovered = findRequestForTestCase(collection, { _id: caseId, materialization: { artifactId: 'missing-artifact' } });
        expect(String(recovered?._id)).toBe(String(requestId));
    });

    test('returns null when neither reference exists', () => {
        const collection = new Collection({ name: 'Generated tests', userId: ownerId, owner: ownerId, requests: [] });
        expect(findRequestForTestCase(collection, { _id: caseId, materialization: { artifactId: 'missing-artifact' } })).toBeNull();
    });
});

describe('test runtime variables', () => {
    test('uses collection variables and lets the selected environment override them', () => {
        const variables = buildRuntimeVariables(
            { variables: [{ key: 'baseUrl', value: 'https://collection.example', enabled: true }, { key: 'disabled', value: 'ignored', enabled: false }] },
            { variables: [{ key: 'baseUrl', value: 'https://environment.example', enabled: true }, { key: 'token', value: 'runtime', enabled: true }] }
        );

        expect(variables).toEqual({ baseUrl: 'https://environment.example', token: 'runtime' });
    });

    test('reports unresolved URL placeholders', () => {
        expect(unresolvedVariableKeys('{{baseUrl}}/users/{{userId}}', { baseUrl: 'https://example.com' })).toEqual(['userId']);
    });
});
