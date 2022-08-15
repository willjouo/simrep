const path = require('path');
const nodeExternals = require('webpack-node-externals');

const config = {
    target: 'node',
    mode: process.env.NODE_ENV || 'production',
    entry: './src/main.ts',
    output: {
        filename: 'main.min.js',
        path: path.resolve(__dirname, 'dist')
    },
    externalsPresets: { node: true },
    externals: [nodeExternals()],
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.js?$/,
                exclude: /node_modules/,
            }
        ],
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    stats: 'errors-warnings'
};

module.exports = [config];