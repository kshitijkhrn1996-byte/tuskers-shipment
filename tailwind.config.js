/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#0f172a',
        canvas: '#FAFAFA',
        brand: { DEFAULT: '#0f766e', light: '#ccfbf1', dark: '#115e59' },
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -16px rgba(15,23,42,0.16)',
        float: '0 1px 2px rgba(15,23,42,0.06), 0 18px 40px -16px rgba(15,23,42,0.28)',
        lift: '0 2px 4px rgba(15,23,42,0.06), 0 10px 24px -10px rgba(15,23,42,0.30)',
        'glow-red': '0 0 0 1px rgba(239,68,68,0.25), 0 0 14px 2px rgba(239,68,68,0.55)',
        'glow-amber': '0 0 0 1px rgba(245,158,11,0.25), 0 0 14px 2px rgba(245,158,11,0.55)',
        'glow-green': '0 0 0 1px rgba(16,185,129,0.25), 0 0 14px 2px rgba(16,185,129,0.55)',
      },
      transitionTimingFunction: { smooth: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
}
