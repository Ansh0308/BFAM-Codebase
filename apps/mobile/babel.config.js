module.exports = function (api) {
  api.cache(true);
  return {
    // nativewind v4 replaces the old `nativewind/babel` plugin (which did
    // synchronous PostCSS style extraction at Babel-transform time — the
    // approach that made nativewind v2 fundamentally incompatible with any
    // real tailwindcss v3, whose plugin main function is unconditionally
    // async) with a Metro-level CSS transform (see metro.config.js's
    // withNativeWind) plus this jsxImportSource, which just annotates JSX
    // so react-native-css-interop can resolve className props at runtime.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
  };
};
