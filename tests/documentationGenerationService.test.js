const { ObjectId } = require('mongodb');

jest.mock('../config/db', () => ({ getDb: jest.fn() }));
jest.mock('../services/CopilotNimClient', () => ({ publicProfiles: jest.fn(() => []), getProfile: jest.fn(), complete: jest.fn() }));

const { getDb } = require('../config/db');
const { processGenerationRun } = require('../services/DocumentationGenerationService');

describe('DocumentationGenerationService', () => {
    test('produces a deterministic review draft when NIM is unavailable', async () => {
        const runId = new ObjectId();
        const collectionId = new ObjectId();
        const run = { _id: runId, collectionId: String(collectionId), status: 'queued', attempts: 0, options: {} };
        let finalUpdate;
        const runs = {
            findOneAndUpdate: jest.fn().mockResolvedValue({ ...run, status: 'running', attempts: 1 }),
            findOne: jest.fn().mockResolvedValue(null),
            updateOne: jest.fn().mockImplementation(async (query, update) => {
                if (update.$set?.status === 'completed' || update.$set?.status === 'partial') finalUpdate = update.$set;
                return { matchedCount: 1 };
            })
        };
        getDb.mockReturnValue({
            collection: (name) => {
                if (name === 'documentationGenerationRuns') return runs;
                if (name === 'collections') return { findOne: jest.fn().mockResolvedValue({
                    _id: collectionId, name: 'Health API', version: '1.0.0', requests: [{ _id: 'request-1', name: 'Health check', method: 'GET', url: 'https://api.example.com/health', description: 'Returns service health.', params: [], authConfig: {} }]
                }) };
                throw new Error(`Unexpected collection ${name}`);
            }
        });

        await processGenerationRun(String(runId));

        expect(finalUpdate.status).toBe('completed');
        expect(finalUpdate.progress).toBe(100);
        expect(finalUpdate.draft.markdown).toContain('Health check');
        expect(finalUpdate.draft.markdown).toContain('## Tutorials');
        expect(finalUpdate.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ai-unavailable' })]));
    });
});
