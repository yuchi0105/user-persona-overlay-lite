import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: path.join(projectRoot, 'src/persona-overlay-lite/index.ts'),
  target: ['web', 'es2022'],
  experiments: { outputModule: true },
  output: {
    path: path.join(projectRoot, 'dist/persona-overlay-lite'),
    filename: 'index.js',
    module: true,
    clean: true,
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        resourceQuery: /raw/,
        type: 'asset/source',
      },
    ],
  },
  plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  optimization: { minimize: true },
  devtool: false,
};

