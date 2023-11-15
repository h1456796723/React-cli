const path = require('path')
const os = require('os')
const { Configuration } = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const WebpackBar = require('webpackbar')
const CopyPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
// 代码压缩
const TerserWebpackPlugin = require('terser-webpack-plugin')
// 压缩图片
const ImageMinimizerWebpackPlugin = require('image-minimizer-webpack-plugin')

// 需要通过 cross-env 定义环境变量
const isProduction = process.env.NODE_ENV === 'production'
const threads = os.cpus().length

const getStyleLoader = (preProcessor) => {
  return [
    'style-loader',
    'css-loader',
    // css 兼容处理
    {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: ['postcss-preset-env']
        }
      }
    },
    preProcessor && {
      loader: preProcessor
    }
  ]
}

/**
 * @type {Configuration} // 配置智能提示
 */
module.exports = {
  entry: './src/index.tsx',
  output: {
    path: isProduction ? path.resolve(__dirname, 'dist') : undefined,
    filename: isProduction ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
    chunkFilename: isProduction ? 'js/[name].[contenthash:8].chunk.js' : 'js/[name].chunk.js',
    assetModuleFilename: 'asset/[hash:10][ext][query]',
    clean: true, // 每次打包都清除上次的打包产物
    pathinfo: false,
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript'
            ],
            cacheDirectory: true,
            cacheCompression: false,
          }
        }
      },
      {
        test: /\.css$/,
        use: getStyleLoader()
      },
      {
        test: /\.less$/,
        use: getStyleLoader('less-loader')
      },
      {
        test: /.(s[ac]ss)$/,
        use: getStyleLoader('sass-loader')
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/imgs',
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024 // 图片大于10kb进行转码
          },
        },
        generator: {
          filename: 'asset/imgs/[hash:10][ext][query]'
        }
      },
      {
        test: /\.(ttf|woff2?|mp4|mp3|avi)$/,
        type: 'asset/resource',
        generator: {
          filename: 'asset/media/[hash:10][ext][query]'
        }
      },
      {
        test: /\.(ttf|woff2?)$/,
        type: 'asset/resource',
        generator: {
          filename: 'asset/fonts/[hash:10][ext][query]'
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    }),
    new CleanWebpackPlugin(),
    new WebpackBar(),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'public'),
          to: path.resolve(__dirname, 'dist'),
          toType: 'dir',
          noErrorOnMissing: true,
          globOptions: {
            ignore: ['**/index.html'],
          },
          info: {
            minimized: true,
          }
        }
      ]
    }),
    isProduction &&
    new MiniCssExtractPlugin({
      // 定义输出文件名和目录
      filename: 'asset/css/[name].[hash:10].css',
      chunkFilename: 'asset/css/[name].[contenthash:10].css'
    })
  ].filter(Boolean),
  // 代码处理
  optimization: {
    // 告知webpack使用TerserPlugin 或其它在 optimization.minimizer定义的插件压缩 bundle
    minimize: isProduction,
    // 压缩的操作
    minimizer: [
      new CssMinimizerPlugin(),  // 压缩css
      // 当前生产模式下会默认开启TerserPlugin，压缩javascript，但是我们需要其它配置，就需要重写了
      new TerserWebpackPlugin({
        parallel: threads, // 开启多进程处理，填入数字是开启几个线程
        terserOptions: {
          compress: {
            drop_console: true, // 删除所有的console.log语句
          }
        }
      }),
      // 压缩图片
      new ImageMinimizerWebpackPlugin({
        minimizer: {
          implementation: ImageMinimizerWebpackPlugin.imageminGenerate,
          options: {
            plugins: [
              ['gifsicle', { interlaced: true }],
              ['jpegtran', { progressive: true }],
              ['optipng', { optimizationLevel: 5 }],
              [
                'svg0',
                {
                  plugins: [
                    'preset-default',
                    'prefixIds',
                    {
                      name: 'sortAttrs',
                      params: {
                        xmlnsOrder: 'alphabetical'
                      }
                    }
                  ]
                }
              ]
            ]
          }
        }
      })
    ],
    // 拆包区域
    splitChunks: {
      chunks: 'all',  // 指定打包加载是同步加载还是异步加载
      cacheGroups: {
        // elementplus
        // elementplus: {
        //   name: 'chunk-elementplus',
        //   test: /[\\/]node_modules[\\/]_?element-pluse(.*)/,
        //   priority: 30,
        // },
        // 将react 相关的代码库单独打包，减少node_modules的chunk体积
        react: {
          name: 'react',
          test: /[\\/]node_modules[\\/]react(.*)/,
          chunks: 'initial',
          priority: 20,
        },
        libs: {
          name: 'chunk-libs',
          test: /[\\/]node_modules[\\/]/,
          priority: 10, // 权重最低，优先考虑前面的内容
          chunks: 'initial',
        }
      }
    },
    // 为运行时代码创建一个额外的 chunk,减少 entry chunk 体积，提高性能
    runtimeChunk: {
      name: (entrypoint) => `runtime~${entrypoint.name}`
    }
  },
  devServer: {
    port: 8080,
    open: true,
    hot: true,
    compress: true,
    historyApiFallback: true,
  },
  mode: isProduction ? 'production' : 'development',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.jsx', '.js', '.json'],
    modules: ['node_modules']
  },
  devtool: isProduction ? 'source-map' : 'cheap-source-map',
}