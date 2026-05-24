/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: '#0A0E27',
          mid: '#11173A',
          soft: '#1A2150',
        },
        amber: { DEFAULT: '#FFA500', glow: 'rgba(255, 165, 0, 0.45)' },
        cyan: { DEFAULT: '#00D9FF', glow: 'rgba(0, 217, 255, 0.45)' },
        gold: '#FFD700',
        success: '#00FF88',
        alert: '#FF3355',
        ink: { DEFAULT: '#DCE7FF', soft: '#8DA3CC', dim: '#5A6B92' },
        line: { DEFAULT: 'rgba(0, 217, 255, 0.18)', strong: 'rgba(0, 217, 255, 0.42)' },
      },
      fontFamily: {
        mono: ['"OCR A Std"', '"Roboto Mono"', '"Courier New"', 'monospace'],
        grid: ['"Roboto Mono"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 18px rgba(255, 165, 0, 0.45)',
        'glow-cyan': '0 0 18px rgba(0, 217, 255, 0.45)',
        'glow-soft': '0 0 24px rgba(0, 217, 255, 0.10)',
      },
      animation: {
        pulse: 'reactor-pulse 2.4s ease-in-out infinite',
        'led-pulse': 'led-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'reactor-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.7 },
          '50%': { transform: 'scale(1.15)', opacity: 1 },
        },
        'led-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
      },
    },
  },
  plugins: [],
};
