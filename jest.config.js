module.exports = {
    // Test environment for Node.js backend tests
    testEnvironment: 'node',

    // Test files patterns
    testMatch: [
        '**/__tests__/**/*.test.js',
        '!**/client/**' // Exclude client tests from backend Jest config
    ],

    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],

    // Coverage configuration
    collectCoverageFrom: [
        'services/**/*.js',
        'routes/**/*.js',
        '!**/node_modules/**',
        '!**/client/**'
    ],

    // Transform configuration (for ES modules if needed)
    transform: {
        '^.+\\.js$': 'babel-jest'
    },

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,

    // Timeout for tests
    testTimeout: 10000
};
