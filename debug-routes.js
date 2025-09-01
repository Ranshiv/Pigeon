// debug-routes.js - Quick diagnostic script
const express = require('express');

console.log('🔍 Starting route diagnostics...');

try {
    console.log('📦 Loading VisualDesign model...');
    const VisualDesign = require('./models/VisualDesign');
    console.log('✅ VisualDesign model loaded successfully');
    console.log('   - Model name:', VisualDesign.modelName);
} catch (error) {
    console.log('❌ VisualDesign model failed:', error.message);
}

try {
    console.log('📦 Loading visual designer routes...');
    const visualDesignerRoutes = require('./routes/visualDesigner');
    console.log('✅ Visual designer routes loaded successfully');
    console.log('   - Route type:', typeof visualDesignerRoutes);
} catch (error) {
    console.log('❌ Visual designer routes failed:', error.message);
}

try {
    console.log('📦 Loading main routes index...');
    const mainRoutes = require('./routes/index');
    console.log('✅ Main routes loaded successfully');
} catch (error) {
    console.log('❌ Main routes failed:', error.message);
}

try {
    console.log('📦 Testing auth middleware...');
    const { authenticateJWT } = require('./middleware/auth');
    console.log('✅ Auth middleware loaded successfully');
    console.log('   - authenticateJWT type:', typeof authenticateJWT);
} catch (error) {
    console.log('❌ Auth middleware failed:', error.message);
}

console.log('🏁 Diagnostic complete');
