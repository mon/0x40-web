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
if (isDevServer) {
    optimization = {
        minimize: false
    };
    svelteCheck = [];
} else {
    optimization = {
        minimizer: [
            new EsbuildPlugin({
                target: 'es2022',  // Syntax to compile to (see options below for possible values)
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
        // alias: { svelte: path.resolve('node_modules', 'svelte/src/runtime') },
        extensions: ['.tsx', '.ts', '.js'],
        mainFields: ['svelte', 'browser', '...'],
        conditionNames: ['svelte', 'browser', '...'],
    },
    optimization: optimization,
};

const commonRules = [
    {
        test: /\.svelte$/,
        use: {
            loader: 'svelte-loader',
            options: {
                preprocess: SveltePreprocess(),
                emitCss: true,
                // note: keep up to date with the one in svelte.config.js
                compilerOptions: {
                    // disable all accessibility warnings
                    warningFilter: (warning) => !warning.code.startsWith('a11y')
                }
            }
        }
    },
    {
        test: /\.svelte\.ts$/,
        use: [
            "svelte-loader",
            { loader: "ts-loader", options: { transpileOnly: true } }],
    },
    {
        test: /(?<!\.svelte)\.ts$/,
        loader: "ts-loader",
        options: {
            transpileOnly: true,
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
            rules: commonRules,
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
            rules: commonRules,
        },

        plugins: [
            new MiniCssExtractPlugin({
                filename: 'css/respack-editor-min.css',
            }),
            ...commonPlugins
        ],
    },
];
