/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('../../packages/ui/tailwind.preset.js')],
  theme: {
    extend: {
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.12)' },
        },
        'pulse-once': {
          '0%, 100%': { boxShadow: '0 -1px 3px rgba(0,0,0,0.06)' },
          '50%': { boxShadow: '0 -4px 16px rgba(0,0,0,0.12)' },
        },
        'chip-activate': {
          '0%, 100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.03)' },
        },
        'chip-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
      },
      animation: {
        'bounce-subtle': 'bounce-subtle 0.25s ease-out',
        'pulse-once': 'pulse-once 0.5s ease-out',
        'chip-activate': 'chip-activate 120ms ease-out',
        'chip-pulse': 'chip-pulse 200ms ease-out',
      },
    },
  },
  plugins: [],
};
