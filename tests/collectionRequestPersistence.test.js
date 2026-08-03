const express = require('express');
const request = require('supertest');
const { ObjectId } = require('mongodb');

const mockGetDb = jest.fn();
jest.mock('../config/db', () => ({ getDb: () => mockGetDb() }));
jest.mock('../middleware/auth', () => ({
    ensureAuthenticated: (req, res, next) => {
        req.user = { id: '507f1f77bcf86cd799439011' };
        next();
    },
    authenticateJWT: (req, res, next) => next()
}));

const router = require('../routes/collections');

describe('collection request persistence', () => {
    let collection;
    let app;

    beforeEach(() => {
        collection = {
            _id: new ObjectId(),
            owner: new ObjectId('507f1f77bcf86cd799439011'),
            name: 'Documentation',
            updatedAt: new Date('2026-08-03T12:00:00Z'),
            requests: [
                { _id: 'request-1', id: 'request-1', name: 'First', method: 'GET', url: 'https://api.example.com/first' },
                { _id: 'request-2', id: 'request-2', name: 'Second', method: 'GET', url: 'https://api.example.com/second' }
            ]
        };
        const collections = {
            findOne: jest.fn(async () => ({ ...collection, requests: collection.requests.map((item) => ({ ...item })) })),
            updateOne: jest.fn(async (filter, update) => {
                if (filter.updatedAt && Number(new Date(filter.updatedAt)) !== Number(new Date(collection.updatedAt))) return { modifiedCount: 0 };
                collection = { ...collection, ...update.$set };
                return { modifiedCount: 1 };
            })
        };
        mockGetDb.mockReturnValue({ collection: (name) => {
            if (name !== 'collections') throw new Error(`Unexpected collection ${name}`);
            return collections;
        } });
        app = express();
        app.use(express.json());
        app.use('/api/collections', router);
    });

    test('updates one request without erasing newer siblings', async () => {
        const response = await request(app)
            .put(`/api/collections/${collection._id}/requests/request-1`)
            .send({ _id: 'request-1', id: 'request-1', name: 'Updated first', method: 'POST', url: 'https://api.example.com/first' });

        expect(response.status).toBe(200);
        expect(response.body.requests).toHaveLength(2);
        expect(response.body.requests.map((item) => item.name)).toEqual(['Updated first', 'Second']);
    });

    test('adds and deletes requests through request-scoped endpoints', async () => {
        const added = await request(app)
            .put(`/api/collections/${collection._id}/requests/request-3`)
            .send({ name: 'Third', method: 'GET', url: 'https://api.example.com/third' });
        expect(added.status).toBe(200);
        expect(added.body.requests).toHaveLength(3);

        const deleted = await request(app).delete(`/api/collections/${collection._id}/requests/request-2`);
        expect(deleted.status).toBe(200);
        expect(deleted.body.requests.map((item) => item.name)).toEqual(['First', 'Third']);
    });
});
