const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'onnx'],
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: false,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);

