jest.mock('../models/MockFaultEvent', () => ({
    create: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn()
}));

const MockFaultEvent = require('../models/MockFaultEvent');
const MockServerService = require('../services/MockServerService');

describe('Fault Lab event retention', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockFaultEvent.create.mockResolvedValue({});
    });

    test('removes only events beyond the per-server retention limit', async () => {
        const oldEvent = { _id: 'old-event' };
        MockFaultEvent.find.mockReturnValue({
            sort: () => ({ skip: () => ({ select: () => ({ lean: async () => [oldEvent] }) }) })
        });

        await MockServerService.recordFaultEvent(
            'server-id',
            { _id: 'profile-id', name: 'Slow network', fault: { type: 'latency' } },
            { method: 'GET', path: '/orders' },
            { status: 200 },
            { delayMs: 100 }
        );

        expect(MockFaultEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            mockServerId: 'server-id', profileName: 'Slow network', faultType: 'latency'
        }));
        expect(MockFaultEvent.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['old-event'] } });
    });

    test('does not issue a deletion when there is no retention overflow', async () => {
        MockFaultEvent.find.mockReturnValue({
            sort: () => ({ skip: () => ({ select: () => ({ lean: async () => [] }) }) })
        });

        await MockServerService.recordFaultEvent(
            'server-id',
            { _id: 'profile-id', name: 'Drop', fault: { type: 'abort' } },
            { method: 'POST', path: '/orders' },
            { status: 200 }
        );

        expect(MockFaultEvent.deleteMany).not.toHaveBeenCalled();
    });
});
