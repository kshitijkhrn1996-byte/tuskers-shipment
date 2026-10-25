/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: { ink: '#0f172a', brand: { DEFAULT: '#0f766e', light: '#ccfbf1', dark: '#115e59' } },
    },
  },
  plugins: [],
}
