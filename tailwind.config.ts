import type { Config } from 'tailwindcss'

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        bg: withOpacity('--bg'),
        surface: withOpacity('--surface'),
        'surface-muted': withOpacity('--surface-muted'),
        ink: withOpacity('--ink'),
        muted: withOpacity('--muted'),
        border: withOpacity('--border'),
        brand: {
          DEFAULT: withOpacity('--brand'),
          dark: withOpacity('--brand-dark'),
          light: withOpacity('--brand-2'),
        },
        sidebar: {
          DEFAULT: withOpacity('--sidebar'),
          accent: withOpacity('--sidebar-accent'),
        },
        ai: {
          DEFAULT: withOpacity('--ai'),
          accent: withOpacity('--ai-accent'),
          bg: withOpacity('--ai-bg'),
        },
        timber: {
          DEFAULT: withOpacity('--timber'),
          dark: withOpacity('--timber-dark'),
        },
        success: {
          DEFAULT: withOpacity('--success'),
          bg: withOpacity('--success-bg'),
        },
        warning: {
          DEFAULT: withOpacity('--warning'),
          bg: withOpacity('--warning-bg'),
        },
        danger: {
          DEFAULT: withOpacity('--danger'),
          bg: withOpacity('--danger-bg'),
        },
        info: {
          DEFAULT: withOpacity('--info'),
          bg: withOpacity('--info-bg'),
        },
      },
      borderRadius: {
        none: '0px',
        sm: '4px',
        md: '6px',
        pill: '999px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgb(var(--border))',
        card: '0 1px 2px 0 rgb(var(--ink) / 0.06), 0 1px 3px 0 rgb(var(--ink) / 0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config
