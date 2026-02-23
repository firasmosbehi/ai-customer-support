/**
 * Shared build settings for the standalone widget bundle.
 * The actual build command is executed from package.json using esbuild CLI.
 */
export const widgetBuildConfig = {
  entry: "widget/embed.ts",
  output: "public/widget.js",
  format: "iife",
  target: "es2018",
  minify: true,
};
