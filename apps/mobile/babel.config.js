module.exports = function (api) {
  const isTest = api.env('test');
  api.cache.using(() => isTest);
  return {
    presets: ['babel-preset-expo'],
    // Under Jest, NativeWind v2's babel plugin either crashes during
    // compile-time style extraction ("Use process(css).then(cb) to work
    // with async plugins", a known NativeWind v2 issue) or, in
    // `transformOnly` mode, resolves styles at runtime on every render,
    // which is slow enough with this module's nested card/list components
    // to blow past Jest's test timeout. Component tests only need to
    // assert behavior, not verify computed styles, so skip the plugin
    // entirely under test — `className` becomes an inert, unused prop
    // (no error) and Metro (the real app bundle) is unaffected.
    plugins: isTest ? [] : ['nativewind/babel'],
  };
};
