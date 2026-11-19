const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function(p) {
  if (p === 'server-only') return {};
  return orig.apply(this, arguments);
};
