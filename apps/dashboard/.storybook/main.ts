import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  framework: "@storybook/nextjs",
  stories: ["../src/**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
    "@storybook/addon-themes",
  ],
  typescript: {
    check: true,
    checkOptions: {
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
    },
  },
  docs: {
    autodocs: "tag",
  },
  core: {
    disableTelemetry: true,
  },
  webpackFinal: async (config) => {
    // Tailwind CSS support
    if (config.module?.rules) {
      config.module.rules.push({
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [["tailwindcss", {}], ["autoprefixer", {}]],
              },
            },
          },
        ],
      });
    }

    // Path alias resolution
    if (config.resolve?.alias) {
      config.resolve.alias["@"] = require("path").resolve(__dirname, "../src/");
    }

    return config;
  },
};

export default config;
