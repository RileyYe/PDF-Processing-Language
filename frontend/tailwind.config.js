/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ms-blue': '#60a5fa',
        'ms-blue-dark': '#3b82f6',
        'ms-blue-light': 'rgba(96, 165, 250, 0.1)',
        'ms-dark': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#0f172a',
          900: '#0c1220',
          950: '#020617'
        }
      },
      fontFamily: {
        'ms': ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        'ms-dark': '0 1.6px 3.6px rgba(0, 0, 0, 0.4), 0 0.3px 0.9px rgba(0, 0, 0, 0.3)',
        'ms-hover-dark': '0 6.4px 14.4px rgba(0, 0, 0, 0.5), 0 1.2px 3.6px rgba(0, 0, 0, 0.4)',
        'ms-glow': '0 0 20px rgba(96, 165, 250, 0.3)'
      }
    },
  },
  plugins: [],
}