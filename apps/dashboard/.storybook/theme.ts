import { create } from "@storybook/theming";

export default create({
  base: "dark",
  brandTitle: "Witylogix Dashboard",
  brandUrl: "https://witylogix.com",
  brandImage: undefined,
  brandTarget: "_self",

  // Colors
  colorPrimary: "#3b82f6",
  colorSecondary: "#06b6d4",
  colorTertiary: "#8b5cf6",

  // UI
  appBg: "#0a0a1a",
  appContentBg: "#1a1a2e",
  appBorderColor: "#2d2d44",
  appBorderRadius: 8,

  // Text
  textColor: "#e0e0e0",
  textInverseColor: "#0a0a1a",

  // Toolbar
  barTextColor: "#e0e0e0",
  barSelectedColor: "#3b82f6",
  barBg: "#1a1a2e",
  barBorderColor: "#2d2d44",

  // Forms
  inputBg: "#1a1a2e",
  inputBorder: "#2d2d44",
  inputBorderRadius: 6,
  inputTextColor: "#e0e0e0",
});
