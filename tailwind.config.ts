import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface-base)',
          card:    'var(--surface-card)',
          elevated:'var(--surface-elevated)',
          border:  'var(--surface-border)',
          hover:   'var(--surface-hover)',
          canvas:  'var(--surface-canvas)',
        },
        accent: {
          DEFAULT:   'rgb(var(--accent-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--accent-secondary-rgb) / <alpha-value>)',
        },
        // ink: theme-aware text color. All dark themes = white. Order = dark charcoal.
        // Use text-ink, text-ink/70, text-ink/30 etc. everywhere instead of text-white.
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
        'panel':   '2px 0 8px rgba(0,0,0,0.4)',
        'preview': '0 8px 32px rgba(0,0,0,0.7)',
      }
    }
  },
  plugins: []
}

export default config
