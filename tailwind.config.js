/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Mirror of COLORS in src/game/constants.ts — must be kept in sync
        bg: '#0E1116',
        surface: '#161B22',
        'surface-2': '#1A1F26',
        border: '#2A2F36',
        text: '#E6EDF3',
        'text-mute': '#9AA4AE',
        'text-dim': '#7D8590',
        accent: '#E8C547',
        // Mirror of ATTRIBUTE_COLORS in src/game/constants.ts — must be kept in sync
        'attr-str': '#C97A6E',
        'attr-dex': '#8FB29D',
        'attr-con': '#D49E63',
        'attr-int': '#7D9BC4',
        'attr-wis': '#A892C7',
        'attr-cha': '#C786A4',
      },
      fontFamily: {
        manrope: ['Manrope_400Regular'],
        'manrope-medium': ['Manrope_500Medium'],
        'manrope-semibold': ['Manrope_600SemiBold'],
        'manrope-bold': ['Manrope_700Bold'],
        'manrope-extrabold': ['Manrope_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
