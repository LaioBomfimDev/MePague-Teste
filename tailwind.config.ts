import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#1C1C1E", // iOS System Gray 7ish
        ios: {
          blue: "#007AFF",
          red: "#FF3B30",
          green: "#34C759",
          gray: "#8E8E93",
          soft: {
            blue: "#F2F7FF",
            purple: "#F5F3FF",
            green: "#F0FDF4",
            peach: "#FFF7ED",
          }
        }
      },
      boxShadow: {
        'ios': '0 2px 14px rgba(0,0,0,0.04)',
        'ios-lg': '0 10px 30px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'ios': '1.25rem', // ~20px
        'ios-lg': '2.5rem', // ~40px
      }
    },
  },
  plugins: [],
};
export default config;
