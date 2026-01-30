import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  content: [
    './src/client/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        'foreground-2': 'var(--color-foreground-2)',
        'foreground-5': 'var(--color-foreground-5)',
        'foreground-10': 'var(--color-foreground-10)',
        'foreground-20': 'var(--color-foreground-20)',
        'foreground-40': 'var(--color-foreground-40)',
        accent: 'var(--color-accent)',
        info: 'var(--color-info)',
        success: 'var(--color-success)',
        destructive: 'var(--color-destructive)',
      },
    },
  },
  plugins: [],
}

export default config
