const mongoose = require('mongoose');

const mockFaultEventSchema = new mongoose.Schema({
    mockServerId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockServer', required: true, index: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    profileName: { type: String, required: true },
    faultType: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, default: 0 },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
    // MongoDB removes old telemetry automatically; the service also caps the
    // most recent per-server history so an active mock cannot grow unbounded.
    createdAt: { type: Date, default: Date.now, index: true, expires: '30d' }
}, { versionKey: false });

mockFaultEventSchema.index({ mockServerId: 1, createdAt: -1 });

module.exports = mongoose.model('MockFaultEvent', mockFaultEventSchema);
