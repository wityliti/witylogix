import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#0a0a1a",
        },
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "brand",
          value: "#1a1a2e",
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "375px",
            height: "812px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1280px",
            height: "720px",
          },
        },
        desktop_xl: {
          name: "Desktop XL",
          styles: {
            width: "1920px",
            height: "1080px",
          },
        },
      },
    },
  },
  decorators: [
    (Story) => {
      // Dark theme wrapper
      return (
        <div
          style={{
            backgroundColor: "#0a0a1a",
            color: "#e0e0e0",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
