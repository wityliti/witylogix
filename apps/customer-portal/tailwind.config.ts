import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wl: {
          bg: {
            root: 'var(--wl-bg-root)',
            surface: 'var(--wl-bg-surface)',
            elevated: 'var(--wl-bg-elevated)',
            overlay: 'var(--wl-bg-overlay)',
            sunken: 'var(--wl-bg-sunken)',
            sidebar: 'var(--wl-bg-sidebar)',
          },
          neutral: {
            50: 'var(--wl-neutral-50)',
            100: 'var(--wl-neutral-100)',
            200: 'var(--wl-neutral-200)',
            300: 'var(--wl-neutral-300)',
            400: 'var(--wl-neutral-400)',
            500: 'var(--wl-neutral-500)',
            600: 'var(--wl-neutral-600)',
            700: 'var(--wl-neutral-700)',
            800: 'var(--wl-neutral-800)',
            900: 'var(--wl-neutral-900)',
          },
          primary: {
            50: 'var(--wl-primary-50)',
            100: 'var(--wl-primary-100)',
            200: 'var(--wl-primary-200)',
            300: 'var(--wl-primary-300)',
            400: 'var(--wl-primary-400)',
            500: 'var(--wl-primary-500)',
            600: 'var(--wl-primary-600)',
            700: 'var(--wl-primary-700)',
            800: 'var(--wl-primary-800)',
            900: 'var(--wl-primary-900)',
          },
          success: {
            400: 'var(--wl-success-400)',
            500: 'var(--wl-success-500)',
            600: 'var(--wl-success-600)',
            bg: 'var(--wl-success-bg)',
          },
          warning: {
            400: 'var(--wl-warning-400)',
            500: 'var(--wl-warning-500)',
            bg: 'var(--wl-warning-bg)',
          },
          danger: {
            400: 'var(--wl-danger-400)',
            500: 'var(--wl-danger-500)',
            600: 'var(--wl-danger-600)',
            bg: 'var(--wl-danger-bg)',
          },
          info: {
            400: 'var(--wl-info-400)',
            500: 'var(--wl-info-500)',
            bg: 'var(--wl-info-bg)',
          },
          text: {
            primary: 'var(--wl-text-primary)',
            secondary: 'var(--wl-text-secondary)',
            tertiary: 'var(--wl-text-tertiary)',
            inverse: 'var(--wl-text-inverse)',
          },
          border: {
            subtle: 'var(--wl-border-subtle)',
            default: 'var(--wl-border-default)',
            strong: 'var(--wl-border-strong)',
            focus: 'var(--wl-border-focus)',
          },
        },
      },
      fontFamily: {
        sans: 'var(--wl-font-sans)',
        mono: 'var(--wl-font-mono)',
      },
      fontSize: {
        xs: 'var(--wl-text-xs)',
        sm: 'var(--wl-text-sm)',
        base: 'var(--wl-text-base)',
        md: 'var(--wl-text-md)',
        lg: 'var(--wl-text-lg)',
        xl: 'var(--wl-text-xl)',
        '2xl': 'var(--wl-text-2xl)',
        '3xl': 'var(--wl-text-3xl)',
      },
      spacing: {
        0: 'var(--wl-space-0)',
        1: 'var(--wl-space-1)',
        2: 'var(--wl-space-2)',
        3: 'var(--wl-space-3)',
        4: 'var(--wl-space-4)',
        5: 'var(--wl-space-5)',
        6: 'var(--wl-space-6)',
        8: 'var(--wl-space-8)',
        10: 'var(--wl-space-10)',
        12: 'var(--wl-space-12)',
      },
      borderRadius: {
        sm: 'var(--wl-radius-sm)',
        md: 'var(--wl-radius-md)',
        lg: 'var(--wl-radius-lg)',
        xl: 'var(--wl-radius-xl)',
        full: 'var(--wl-radius-full)',
      },
      boxShadow: {
        sm: 'var(--wl-shadow-sm)',
        md: 'var(--wl-shadow-md)',
        lg: 'var(--wl-shadow-lg)',
        glow: 'var(--wl-shadow-glow)',
      },
      transitionDuration: {
        fast: 'var(--wl-duration-fast)',
        base: 'var(--wl-duration-base)',
        slow: 'var(--wl-duration-slow)',
      },
      transitionTimingFunction: {
        default: 'var(--wl-ease-default)',
        spring: 'var(--wl-ease-spring)',
      },
    },
  },
  plugins: [],
};

export default config;
