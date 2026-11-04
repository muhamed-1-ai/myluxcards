const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments);
};
try {
  const resolved = require.resolve("server-only");
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {}
  };
} catch (e) {}

