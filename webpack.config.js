const webpack = require('webpack');
const path = require('path');
const process = require('process');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const SveltePreprocess = require('svelte-preprocess');
const SvelteCheckPlugin = require('svelte-check-plugin');
const { EsbuildPlugin } = require('esbuild-loader');

const isDevServer = process.env.WEBPACK_SERVE;

let optimization;
let svelteCheck;
if(isDevServer) {
    optimization = {
        minimize: false
    };
    svelteCheck = [];
} else {
    optimization = {
        minimizer: [
            new EsbuildPlugin({
                target: 'es2020',  // Syntax to compile to (see options below for possible values)
                css: true  // Apply minification to CSS assets
            }),
        ],
    };
    svelteCheck = [new SvelteCheckPlugin()];
}

const commonSettings = {
    mode: 'production',
    devtool: 'source-map',
    performance: {
        hints: false,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    optimization: optimization,
};

const commonRules = [
    {
        test: /\.svelte$/,
        use: {
            loader: 'svelte-loader',
            options: {
                preprocess: SveltePreprocess()
            }
        }
    },
    {
        test: /\.tsx?$/,
        loader: "esbuild-loader",
        exclude: /node_modules/,
        options: {
            loader: 'ts',
            target: 'es2020'
        }
    },
    {
        test: /.s?css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],//, "sass-loader"],
    },
    {
        test: /\.(png|jpe?g|gif|eot|svg|ttf|woff|ico|html)$/i,
        type: 'asset/resource',
    },
];

const commonPlugins = [
    new webpack.DefinePlugin({
        VERSION: JSON.stringify(require("./package.json").version)
    }),
    ...svelteCheck
];

module.exports = [
    {
        ...commonSettings,
        entry: './src/js/HuesCore.ts',
        output: {
            filename: 'lib/hues-min.js',
            path: path.resolve(__dirname, 'dist'),
            assetModuleFilename: '[path][name][ext][query]'
        },

        module: {
            rules: [
                ...commonRules,
                // audio worker + sources should just be copied as-is
                {
                    test: /(audio-worker|mpg123|ogg|vorbis)\.js$/,
                    type: 'asset/resource',
                },
            ],
        },

        plugins: [new MiniCssExtractPlugin({
            filename: 'css/hues-min.css',
        }), ...commonPlugins],
    },
    {
        ...commonSettings,
        entry: './src/js/RespackEditor/main.ts',
        output: {
            filename: 'lib/respack-editor-min.js',
            path: path.resolve(__dirname, 'dist'),
            assetModuleFilename: '[path][name][ext][query]'
        },

        module: {
            rules: [
                ...commonRules,
            ],
        },

        plugins: [
            new MiniCssExtractPlugin({
                filename: 'css/respack-editor-min.css',
            }),
            ...commonPlugins
        ],
    },
    // audio workers are lazy-loaded so get compiled separately
    {
        entry: './src/js/audio/aurora.js',
        mode: 'production',
        output: {
            filename: 'lib/audio-min.js',
            path: path.resolve(__dirname, 'dist'),
        },
        performance: {
            hints: false,
        },
        module: {
            rules: [
                // audio worker + sources should just be copied as-is
                {
                    test: /(mpg123|ogg|vorbis|opus)\.js$/,
                    type: 'asset/resource',
                    generator : {filename : 'lib/[name][ext][query]'},
                },
                {
                    test: /audio-worker\.js$/,
                    type: 'asset/resource',
                    generator : {filename : 'lib/workers/[name][ext][query]'},
                },
            ],
        },
    }];
