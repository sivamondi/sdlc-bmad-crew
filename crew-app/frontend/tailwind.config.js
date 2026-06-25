/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#1a1f2e',
          hover: '#252c3f',
          active: '#2d3550',
          border: '#2a3147',
        },
      },
    },
  },
}
