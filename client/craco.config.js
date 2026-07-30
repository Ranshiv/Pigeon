const webpack = require('webpack');

const sentryPlugins = [];
if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    // Load this only for authenticated production builds so local development
    // remains usable before the client dependencies are installed/configured.
    const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
    sentryPlugins.push(sentryWebpackPlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: {
            name: process.env.REACT_APP_SENTRY_RELEASE || process.env.SENTRY_RELEASE
        },
        sourcemaps: {
            assets: ['build/**/*.js', 'build/**/*.js.map'],
            filesToDeleteAfterUpload: ['build/**/*.map']
        },
        telemetry: false,
        silent: true
    }));
}

module.exports = {
    devServer: {
        allowedHosts: 'all',
    },
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    process: require.resolve('process/browser.js'),
                    zlib: require.resolve('browserify-zlib'),
                    stream: require.resolve('stream-browserify'),
                    util: require.resolve('util'),
                    buffer: require.resolve('buffer'),
                    assert: require.resolve('assert'),
                },
            },
        },
        plugins: [
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
                process: 'process/browser.js',
            }),
            ...sentryPlugins
        ],
    },
};
