const mongoose = require('mongoose');

const fuzzCaseSchema = new mongoose.Schema({ id: String, category: String, name: String, mutation: String, overrides: mongoose.Schema.Types.Mixed, status: String, responseStatus: Number, duration: Number, error: String }, { _id: false });
const fuzzRunSchema = new mongoose.Schema({ collectionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null }, sourceType: { type: String, enum: ['openapi', 'graphql', 'request-body'], required: true }, sourceId: String, operation: String, environmentName: String, userId: { type: mongoose.Schema.Types.ObjectId, required: true }, status: { type: String, enum: ['running', 'completed', 'failed'], default: 'completed' }, total: Number, passed: Number, failed: Number, cases: [fuzzCaseSchema], createdAt: { type: Date, default: Date.now } });
module.exports = mongoose.model('FuzzRun', fuzzRunSchema);
