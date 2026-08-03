jest.mock('axios', () => jest.fn());

const axios = require('axios');
const { runRequest } = require('../cli/runner');

describe('CLI request runner errors', () => {
    beforeEach(() => jest.clearAllMocks());

    test('preserves the underlying request error when no variable context exists', async () => {
        axios.mockRejectedValueOnce(new Error('Target connection was refused'));

        await expect(runRequest({
            name: 'Unavailable target',
            method: 'GET',
            url: 'http://127.0.0.1:1'
        })).rejects.toMatchObject({ message: 'Target connection was refused' });
    });

    test('returns non-2xx HTTP responses for assertion evaluation', async () => {
        axios.mockImplementationOnce(async (config) => {
            expect(config.validateStatus(404)).toBe(true);
            return {
                status: 404,
                statusText: 'Not Found',
                headers: { 'content-type': 'application/json' },
                data: { message: 'User not found' }
            };
        });

        await expect(runRequest({
            name: 'Missing user',
            method: 'GET',
            url: 'https://example.com/users/missing'
        })).resolves.toMatchObject({
            response: { status: 404, statusText: 'Not Found' },
            error: null
        });
    });
});
