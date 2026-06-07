/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark command-center surface — deep charcoal, GitHub-dark inspired
        bg: {
          deep: '#0D1117', // app background
          mid: '#161B22', // raised surfaces / cards
          soft: '#1C2230', // hover / inset surfaces
        },
        // Primary accent — electric blue
        blue: { DEFAULT: '#3B82F6', soft: '#60A5FA', deep: '#1D4ED8', glow: 'rgba(59, 130, 246, 0.45)' },
        // `cyan` retained as a token name (used across pages) but retuned to the
        // electric-blue accent so the whole UI reads as one palette.
        cyan: { DEFAULT: '#3B82F6', glow: 'rgba(59, 130, 246, 0.40)' },
        // Amber kept as a sparing secondary highlight for the JARVIS identity.
        amber: { DEFAULT: '#F59E0B', glow: 'rgba(245, 158, 11, 0.40)' },
        gold: '#FBBF24',
        success: '#22C55E',
        alert: '#EF4444',
        ink: { DEFAULT: '#E6EDF3', soft: '#9BA9BC', dim: '#6E7B91' },
        // Subtle card borders (#1F2937 family)
        line: { DEFAULT: '#1F2937', strong: '#30363D' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        grid: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 18px rgba(59, 130, 246, 0.40)',
        'glow-cyan': '0 0 18px rgba(59, 130, 246, 0.40)',
        'glow-amber': '0 0 18px rgba(245, 158, 11, 0.35)',
        'glow-soft': '0 0 24px rgba(59, 130, 246, 0.10)',
        card: '0 1px 0 0 rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      animation: {
        pulse: 'reactor-pulse 2.4s ease-in-out infinite',
        'led-pulse': 'led-pulse 2s ease-in-out infinite',
        'typing-dot': 'typing-dot 1.2s ease-in-out infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
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
        'typing-dot': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
          '30%': { transform: 'translateY(-4px)', opacity: 1 },
        },
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
