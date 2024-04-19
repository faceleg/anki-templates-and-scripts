const html = require("@html-eslint/eslint-plugin");
const parser = require("@html-eslint/parser");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = [
  // recommended configuration included in the plugin
  html.configs["flat/recommended"],
  // your own configurations.
  {
    files: ["**/*.html"],
    plugins: {
      "@html-eslint": html,
    },
    languageOptions: {
      parser,
    },
    rules: {
      "@html-eslint/indent": "error",
      // "prettier/prettier": "error"
    },
  },
  eslintPluginPrettierRecommended,
];
