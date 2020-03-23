const { createDefaultConfig } = require('@open-wc/testing-karma');

module.exports = config => {
  const defaultConfig = createDefaultConfig(config);
  const mixinConfig = {
    ...defaultConfig,
    // browsers: ['ChromeCanary'],
    files: [
      { pattern: config.grep ? config.grep : 'test/**/*.test.js', type: 'module' },
    ],
    esm: {
      ...defaultConfig.esm,
      nodeResolve: true,
    },
  };

  // console.log(mixinConfig);
  config.set(mixinConfig);
};
