import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F97316',
          dark: '#1C1917',
          steel: '#374151',
        }
      }
    },
  },
  plugins: [],
}
export default config
