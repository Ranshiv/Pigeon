// Regression tests for the integration alert-delivery path.
// Each test names the bug it catches; all were written to fail against the
// pre-fix code and verified failing before the fix was kept.
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ownerId = new mongoose.Types.ObjectId();
const workspaceId = new mongoose.Types.ObjectId();

jest.mock('../middleware/auth', () => ({
    ensureAuthenticated: (req, res, next) => {
        req.user = { id: req.app.locals.userId, email: 'owner@gmail.com' };
        next();
    }
}));

jest.mock('../config/db', () => ({
    getDb: jest.fn()
}));

const { getDb } = require('../config/db');
const Integration = require('../models/Integration');

let mongod;
let app;

const emailBody = {
    name: 'Prod Email',
    type: 'email',
    enabled: true,
    configuration: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'owner@gmail.com',
        smtpPass: 'app-password',
        fromEmail: 'owner@gmail.com'
    }
};

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    app = express();
    app.use(express.json());
    app.locals.userId = ownerId.toString();
    app.use('/api/integrations', require('../routes/integrations'));
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

beforeEach(async () => {
    await Integration.deleteMany({});
});

describe('POST /api/integrations', () => {
    test('creates an account-level integration without a personal workspace', async () => {
        const res = await request(app).post('/api/integrations').send(emailBody).expect(201);

        const saved = await Integration.findById(res.body._id);
        expect(saved.workspaceId).toBeNull();
        expect(getDb).not.toHaveBeenCalled();
    });

    // BUG: MonitoringService queries `'configuration.enabledEvents': {$in:[...]}`.
    // Nothing set enabledEvents, so no saved integration ever matched and no
    // real alert was ever delivered — only the manual Test button worked.
    test('saves enabledEvents so the monitoring query can match the integration', async () => {
        const res = await request(app).post('/api/integrations').send(emailBody).expect(201);

        const saved = await Integration.findById(res.body._id);
        expect(saved.configuration.enabledEvents).toEqual(
            expect.arrayContaining(['monitor_down', 'monitor_up', 'monitor_degraded'])
        );

        // Account-level integrations are available for the integration
        // delivery query without requiring a workspace.
        const matched = await Integration.find({
            workspaceId: null,
            isActive: true,
            'configuration.enabledEvents': { $in: ['monitor_down', 'monitor_up', 'monitor_degraded'] }
        });
        expect(matched).toHaveLength(1);
    });

    // BUG: the UI sends `enabled`, the model stores `isActive`. `enabled: false`
    // was dropped on the floor, so a disabled integration stayed active.
    test('persists enabled:false as isActive:false', async () => {
        const res = await request(app)
            .post('/api/integrations')
            .send({ ...emailBody, enabled: false })
            .expect(201);

        const saved = await Integration.findById(res.body._id);
        expect(saved.isActive).toBe(false);
        expect(res.body.enabled).toBe(false);
    });

    test('rejects an invalid configuration instead of saving it', async () => {
        await request(app)
            .post('/api/integrations')
            .send({ name: 'Bad', type: 'email', configuration: { smtpHost: 'smtp.gmail.com' } })
            .expect(400);

        expect(await Integration.countDocuments()).toBe(0);
    });
});

describe('GET /api/integrations', () => {
    // BUG: the list route did `.select('-configuration.webhookUrl')`, so every
    // Slack/Discord/Teams card rendered as configured-but-empty.
    test('returns webhookUrl so configured channels render', async () => {
        await Integration.create({
            name: 'Slack', type: 'slack', workspaceId, userId: ownerId,
            configuration: { webhookUrl: 'https://hooks.slack.com/services/A/B/C', enabledEvents: ['monitor_down'] }
        });

        const res = await request(app).get('/api/integrations').expect(200);
        expect(res.body[0].configuration.webhookUrl).toBe('https://hooks.slack.com/services/A/B/C');
    });

    test('masks secrets and exposes enabled for the UI toggle', async () => {
        await Integration.create({ ...emailBody, workspaceId, userId: ownerId, isActive: true });

        const res = await request(app).get('/api/integrations').expect(200);
        expect(res.body[0].configuration.smtpPass).toBe('***');
        expect(res.body[0].enabled).toBe(true);
    });
});

describe('PUT /api/integrations/:id', () => {
    // BUG: GET masked apiToken/smtpPass, the edit form loaded the mask, and PUT
    // wrote the literal '***' over the real secret — silently breaking delivery.
    test('does not overwrite a real secret with the masked placeholder', async () => {
        const created = await Integration.create({ ...emailBody, workspaceId, userId: ownerId });

        await request(app)
            .put(`/api/integrations/${created._id}`)
            .send({ name: 'Renamed', configuration: { smtpPass: '***', smtpUser: 'owner@gmail.com' } })
            .expect(200);

        const saved = await Integration.findById(created._id);
        expect(saved.configuration.smtpPass).toBe('app-password');
        expect(saved.name).toBe('Renamed');
    });

    // BUG: findOneAndUpdate skips the pre('save') hook, so an invalid config
    // saved cleanly and only blew up later at send time.
    test('rejects an update that would make the configuration invalid', async () => {
        const created = await Integration.create({ ...emailBody, workspaceId, userId: ownerId });

        await request(app)
            .put(`/api/integrations/${created._id}`)
            .send({ configuration: { smtpHost: '' } })
            .expect(400);

        const saved = await Integration.findById(created._id);
        expect(saved.configuration.smtpHost).toBe('smtp.gmail.com');
    });

    test('toggling enabled flips isActive', async () => {
        const created = await Integration.create({ ...emailBody, workspaceId, userId: ownerId, isActive: true });

        await request(app).put(`/api/integrations/${created._id}`).send({ enabled: false }).expect(200);

        expect((await Integration.findById(created._id)).isActive).toBe(false);
    });
});
