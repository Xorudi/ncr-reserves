/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FDFAF7', 100: '#F6F1EB', 200: '#EDE4D8', 300: '#E8E2DC' },
        brand: { DEFAULT: '#C4622D', light: '#D4733E', dark: '#A84E22', soft: '#F3E8E0' },
        warm: { 100: '#F0EBE3', 200: '#E8E2DC', 300: '#D6CFC5', 400: '#9B9490', 500: '#6B6B6B', 600: '#4A4A4A', 700: '#2A2A2A', 800: '#1A1A1A' },
        status: { confirmed: '#16A34A', 'confirmed-bg': '#DCFCE7', pending: '#D97706', 'pending-bg': '#FEF3C7', seated: '#C4622D', 'seated-bg': '#F3E8E0', cancelled: '#9CA3AF', 'cancelled-bg': '#F3F4F6' },
      },
      fontFamily: { sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.04)', panel: '0 2px 8px 0 rgba(0,0,0,0.06)' },
      borderRadius: { DEFAULT: '0.5rem', lg: '0.75rem', xl: '1rem' },
    },
  },
  plugins: [],
}
