/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { 50: '#fbf1f1', 100: '#f4dcdc', 600: '#a31416', 700: '#850e10', 800: '#6b0b0d', 900: '#4f080a' },
        gold: { 300: '#fbe97a', 400: '#f8de4a', 500: '#eac80f' },
        paper: '#f5f5f5',
      },
      fontFamily: { sans: ['Poppins', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
