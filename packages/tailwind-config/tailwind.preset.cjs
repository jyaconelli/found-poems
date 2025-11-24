const colors = require('tailwindcss/colors');

module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f3f2',
          100: '#e7e4e0',
          200: '#cfc7bf',
          300: '#b7aa9f',
          400: '#9e8e7f',
          500: '#85735f',
          600: '#6a5a49',
          700: '#514336',
          800: '#382d24',
          900: '#201a15'
        },
        highlight: colors.amber
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia']
      }
    }
  }
};
