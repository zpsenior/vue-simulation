const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
  const isProduction = process.env.NODE_ENV === 'production';

  const config = {
    mode: isProduction ? 'production' : 'development',
    entry: {
      lib: './src/index.ts', // 库入口
      test: './test/test.ts', // 应用入口
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    output: {
      filename: (pathData) => {
        // 为不同的入口指定不同的输出文件名
        if (pathData.chunk.name === 'lib') {
          return 'index.js'; // 库文件保持原名
        }
        return '[name].js'; // 应用文件使用入口名称
      },
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'vs',
        type: 'umd',
        umdNamedDefine: true,
      },
      globalObject: 'this',
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanStaleWebpackAssets: true,
      }),
      new HtmlWebpackPlugin({
        template: './test/test.html',
        filename: 'test.html',
        chunks: ['lib', 'test'], // 同时包含库和应用
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'example'), to: path.join(__dirname, 'dist'),
          },
        ]
      })
    ],
    externals: [], // 如果有外部依赖，在这里定义
  };

  // 开发模式特有配置
  if (!isProduction) {
    config.devServer = {
      static: {
        directory: path.join(__dirname, 'test'),
        // 确保dist目录也能被访问，这样可以直接引用编译后的库文件
        watch: {
          ignored: /node_modules/,
        },
      },
      compress: true,
      port: 3002,
      open: true,
      hot: true,
      setupMiddlewares: (middlewares, devServer) => {
        // 添加一个中间件来提供对dist目录的访问
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined');
        }

        devServer.app.get('/dist/*', (req, res) => {
          res.sendFile(path.join(__dirname, req.path));
        });

        return middlewares;
      },
    };
    config.devtool = 'inline-source-map';
  }

  return config;
};