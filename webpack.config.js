const path = require('path');
const process = require('process');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const SveltePreprocess = require('svelte-preprocess');

const isDevServer = process.env.WEBPACK_SERVE;

let optimization;
if(isDevServer) {
    optimization = {
        minimize: false
    };
} else {
    optimization = {
        minimizer: [
            `...`,
            new CssMinimizerPlugin(),
        ],
    };
}

module.exports = [
    {
        entry: './src/js/HuesCore.ts',
        mode: 'production',
        devtool: 'source-map',
        output: {
            filename: 'lib/hues-min.js',
            path: path.resolve(__dirname, 'dist'),
            assetModuleFilename: '[path][name][ext][query]'
        },
        performance: {
            hints: false,
        },
        module: {
            rules: [
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
                    loader: "ts-loader",
                    exclude: /node_modules/
                },
                {
                    test: /\.js$/,
                    loader: "source-map-loader"
                },
                {
                    test: /.s?css$/,
                    use: [MiniCssExtractPlugin.loader, "css-loader"],//, "sass-loader"],
                },
                {
                    test: /\.(png|jpe?g|gif|eot|svg|ttf|woff|ico|html)$/i,
                    type: 'asset/resource',
                },
                // audio worker + sources should just be copied as-is
                {
                    test: /(audio-worker|mpg123|ogg|vorbis)\.js$/,
                    type: 'asset/resource',
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        optimization: optimization,
        plugins: [new MiniCssExtractPlugin({
            filename: 'css/hues-min.css',
        })],
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
