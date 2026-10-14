// Loaded before every test file (node --require): makes `require("obsidian")` return the mock.
const Module = require("module");
const mock = require("./obsidian-mock.cjs");
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "obsidian") return mock.obsidian;
  return load.call(this, request, ...rest);
};
