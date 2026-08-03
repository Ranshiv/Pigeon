const Collection = require('../models/Collection');
const mongoose = require('mongoose');

describe('Collection.hasAccess', () => {
    test('does not throw for legacy collections with missing ownership fields', () => {
        const collection = new Collection({ name: 'Legacy collection', isPublic: true, collaborators: [{}] });

        expect(() => collection.hasAccess('user-1', 'editor')).not.toThrow();
        expect(collection.hasAccess('user-1', 'editor')).toBe(false);
        expect(collection.hasAccess('user-1', 'viewer')).toBe(true);
    });

    test('ignores collaborators whose user id is missing', () => {
        const collection = new Collection({
            name: 'Partially migrated collection',
            userId: '507f1f77bcf86cd799439011',
            owner: '507f1f77bcf86cd799439011',
            collaborators: [{ role: 'admin' }]
        });

        expect(collection.hasAccess('507f191e810c19729de860ea', 'viewer')).toBe(false);
    });
});

describe('Collection embedded request identifiers', () => {
    test('preserves legacy string ids while allowing ObjectId-backed requests', () => {
        const ownerId = new mongoose.Types.ObjectId();
        const collection = new Collection({
            name: 'Mixed request identifiers',
            userId: ownerId,
            owner: ownerId,
            requests: [
                { _id: 'req-1785126232144', name: 'Legacy request', method: 'GET', url: 'https://example.com/legacy' },
                { name: 'New request', method: 'GET', url: 'https://example.com/new' }
            ]
        });

        expect(collection.validateSync()).toBeUndefined();
        expect(collection.requests[0]._id).toBe('req-1785126232144');
        expect(collection.requests.id('req-1785126232144')?.name).toBe('Legacy request');
        expect(collection.requests[1]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    });
});
