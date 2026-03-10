import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'wl-bg': {
          primary: '#0a0a1a',
          secondary: '#1a1a2e',
          tertiary: '#2a2a4e',
        },
        'wl-text': {
          DEFAULT: '#e0e0ff',
          secondary: '#a0a0c0',
          muted: '#707090',
        },
        'wl-accent': {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        },
        'wl-border': {
          DEFAULT: '#3a3a5e',
          light: '#4a4a6e',
        },
        'wl-status': {
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e0e0ff',
            a: {
              color: '#6366f1',
              '&:hover': {
                color: '#818cf8',
              },
            },
            code: {
              color: '#818cf8',
              backgroundColor: '#1a1a2e',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: '#1a1a2e',
              color: '#e0e0ff',
              border: '1px solid #3a3a5e',
            },
            'h1, h2, h3, h4, h5, h6': {
              color: '#e0e0ff',
            },
            strong: {
              color: '#e0e0ff',
              fontWeight: '600',
            },
            blockquote: {
              color: '#a0a0c0',
              borderLeftColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
            },
            hr: {
              borderColor: '#3a3a5e',
            },
            th: {
              color: '#e0e0ff',
              backgroundColor: '#1a1a2e',
              borderColor: '#3a3a5e',
            },
            td: {
              borderColor: '#3a3a5e',
            },
            'ul > li::marker': {
              color: '#6366f1',
            },
            'ol > li::marker': {
              color: '#6366f1',
            },
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'wl-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'wl-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'wl-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'wl-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'wl-gradient': 'linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
