/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        wl: {
          foreground: "hsl(var(--wl-foreground) / <alpha-value>)",
          background: "hsl(var(--wl-background) / <alpha-value>)",
          muted: {
            foreground: "hsl(var(--wl-muted-foreground) / <alpha-value>)",
            DEFAULT: "hsl(var(--wl-muted) / <alpha-value>)",
          },
          accent: "hsl(var(--wl-accent) / <alpha-value>)",
          success: "hsl(var(--wl-success) / <alpha-value>)",
          warning: "hsl(var(--wl-warning) / <alpha-value>)",
          destructive: "hsl(var(--wl-destructive) / <alpha-value>)",
          border: "hsl(var(--wl-border) / <alpha-value>)",
          blue: "hsl(var(--wl-blue) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
