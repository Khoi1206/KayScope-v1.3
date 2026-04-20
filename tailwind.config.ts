import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // All tokens backed by CSS custom properties — see globals.css
        'th-bg':            'var(--th-bg)',
        'th-nav':           'var(--th-nav)',
        'th-sidebar':       'var(--th-sidebar)',
        'th-tabbar':        'var(--th-tabbar)',
        'th-surface':       'var(--th-surface)',
        'th-surface-hover': 'var(--th-surface-hover)',
        'th-raised':        'var(--th-raised)',
        'th-input':         'var(--th-input)',
        'th-border':        'var(--th-border)',
        'th-border-soft':   'var(--th-border-soft)',
        // Text
        'th-fg':            'var(--th-fg)',
        'th-fg-muted':      'var(--th-fg-muted)',
        'th-fg-subtle':     'var(--th-fg-subtle)',
        // Accent
        'th-accent':        'var(--th-accent)',
        'th-accent-hover':  'var(--th-accent-hover)',
        // Semantic
        'th-error':         'var(--th-error)',
        'th-warning':       'var(--th-warning)',
        'th-success':       'var(--th-success)',
      },
    },
  },
  plugins: [],
}

export default config
