/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nebula: {
          950: '#07090e',
          900: '#0c1017',
          850: '#121824',
          800: '#1a2232',
          750: '#232e42',
          700: '#2e3b52',
          accent: '#10b981', // NebulaX Emerald (Primary Brand Color #1)
          cyber: '#06b6d4',  // Singularity Cyber Cyan (Primary Brand Color #2)
          sky: '#38bdf8',    // Horizon Sky Cyan (Primary Brand Color #3)
          warning: '#f59e0b',// Amber alert
          danger: '#ef4444', // Red crash
          purple: '#8b5cf6'  // Prism violet
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
};
