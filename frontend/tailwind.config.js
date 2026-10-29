/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#F4F7FB',
          surface: '#FFFFFF',
          surfaceMuted: '#F8FAFC',
          border: '#E2E8F0',
          borderHover: '#CBD5E1',
          navy: '#0F172A',
          navyLight: '#1E293B',
          blue: '#2563EB',
          blueLight: '#EFF6FF',
          blueBorder: '#BFDBFE',
          cyan: '#0284C7',
          amberBg: '#FEF3C7',
          amberBorder: '#FDE68A',
          amberText: '#92400E',
          textPrimary: '#0F172A',
          textSecondary: '#475569',
          textMuted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
    },
  },
  plugins: [],
}
