/* Tailwind config for the frontend react app. This is where the app theme should be defined: https://v2.tailwindcss.com/docs/configuration. */
import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'
import typographyPlugin from '@tailwindcss/typography'
import aspectRatioPlugin from '@tailwindcss/aspect-ratio'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '!./src/**/__tests__/**',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      keyframes: {
        'fab-breathe': {
          /* R55: Respiração lenta (ciclo 3.5s ativo) + pausa serena de ~12s (total 19s: ~18% ativos, 82% em repouso) */
          /* 0s a 3.5s (0% a 18.4%): ciclo de respiração sutil (amplitude máxima de escala 1.03 = 3%) */
          '0%': {
            transform: 'scale(1)',
            boxShadow: '0 10px 30px -10px rgba(20, 33, 61, 0.18), 0 0 0 0 rgba(252, 163, 17, 0)',
          },
          '9.2%': {
            /* ~1.75s: pico da respiração sutil (escala 1.03 = +3%, sombra âmbar translúcida e discreta) */
            transform: 'scale(1.03)',
            boxShadow:
              '0 12px 30px -8px rgba(20, 33, 61, 0.22), 0 0 0 4px rgba(252, 163, 17, 0.12)',
          },
          '18.4%': {
            /* ~3.5s: retorno suave ao repouso */
            transform: 'scale(1)',
            boxShadow: '0 10px 30px -10px rgba(20, 33, 61, 0.18), 0 0 0 0 rgba(252, 163, 17, 0)',
          },
          /* 18.4% até 100% (~15.5s de repouso silencioso antes do próximo ciclo discreto) */
          '100%': {
            transform: 'scale(1)',
            boxShadow: '0 10px 30px -10px rgba(20, 33, 61, 0.18), 0 0 0 0 rgba(252, 163, 17, 0)',
          },
        },
      },
      animation: {
        'fab-breathe': 'fab-breathe 19s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['Inter var', 'SF Pro Display', 'system-ui', 'sans-serif'],
        display: ['SF Pro Display', 'Inter var', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        brand: {
          DEFAULT: '#221D1B',
          dark: '#191514',
          light: '#2B2523',
          amber: '#FCA311',
          gray: '#342E2B',
        },
        buckets: {
          essentials: '#221D1B',
          lifestyle: '#FCA311',
          goals: '#34B88A',
        },
        finance: {
          income: '#34B88A',
          expense: '#E5677D',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        // CDS v2.0 / v3.0 — ponte de utilitários para os tokens de src/main.css
        // Em dark total, `text-ink` precisa de alto contraste (#ffffff via --ink-text),
        // enquanto `bg-ink` permanece o preto quente #221D1B canônico oficial do Curiangoo.
        ink: {
          DEFAULT: 'var(--ink)',
          text: 'var(--ink-text, #ffffff)',
          hover: 'var(--ink-hover)',
          subtle: 'var(--ink-subtle)',
        },
        action: {
          DEFAULT: 'var(--action)',
          hover: 'var(--action-hover)',
          subtle: 'var(--action-subtle)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        bg: 'var(--bg)',
        body: 'var(--text)',
        body2: 'var(--text-2)',
        body3: 'var(--text-3)',
        income: {
          DEFAULT: 'var(--income)',
          subtle: 'var(--income-subtle)',
        },
        expense: {
          DEFAULT: 'var(--expense)',
          subtle: 'var(--expense-subtle)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
        },
        data: {
          1: 'var(--data-1)',
          2: 'var(--data-2)',
          3: 'var(--data-3)',
          4: 'var(--data-4)',
          5: 'var(--data-5)',
          6: 'var(--data-6)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      transitionProperty: {
        width: 'width',
        height: 'height',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        elevation: '0 4px 20px rgba(0, 0, 0, 0.05)',
        curiango: '0 10px 30px -10px rgba(20, 33, 61, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
        'curiango-dock': '0 20px 40px -15px rgba(20, 33, 61, 0.12)',
        // Sistema de profundidade e elevação CDS v1.0 (3 níveis refinados de sombra)
        'elevation-1':
          '0 2px 8px -2px rgba(20, 33, 61, 0.04), 0 12px 28px -10px rgba(20, 33, 61, 0.06)',
        'elevation-2':
          '0 4px 12px -2px rgba(20, 33, 61, 0.05), 0 16px 36px -10px rgba(20, 33, 61, 0.08)',
        'elevation-3':
          '0 8px 24px -4px rgba(20, 33, 61, 0.08), 0 24px 48px -12px rgba(20, 33, 61, 0.14)',
        // CDS v2.0 — sombras por token (src/main.css)
        cds: 'var(--shadow-card)',
        'cds-float': 'var(--shadow-float)',
        'cds-dock': 'var(--shadow-dock)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.42, 0, 0.58, 1)',
      },
    },
  },
  plugins: [animatePlugin, typographyPlugin, aspectRatioPlugin],
} satisfies Config
