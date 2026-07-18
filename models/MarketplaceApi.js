const mongoose = require('mongoose');

const ParameterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['query', 'path', 'header', 'body'], required: true },
    required: { type: Boolean, default: false },
    description: String
});

const EndpointSchema = new mongoose.Schema({
    path: { type: String, required: true },
    method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'], required: true },
    description: String,
    parameters: [ParameterSchema],
    sample: { type: mongoose.Schema.Types.Mixed, default: null }, // curl-verified example values per Try It
    body: mongoose.Schema.Types.Mixed // Flexible structure for body schema definition
});

const MarketplaceApiSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Keeping string ID for URL friendliness
    name: { type: String, required: true },
    provider: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, index: true },
    tags: [{ type: String, index: true }],
    authType: { type: String, default: 'None' },
    pricing: { type: String, default: 'Free' },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    baseUrl: { type: String, required: true },
    logo: String,
    endpoints: [EndpointSchema],
    documentation: String,
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Text index for search
MarketplaceApiSchema.index({
    name: 'text',
    description: 'text',
    provider: 'text',
    tags: 'text'
});

module.exports = mongoose.models.MarketplaceApi || mongoose.model('MarketplaceApi', MarketplaceApiSchema);
