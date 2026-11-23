/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172d31",
        muted: "#78878a",
        line: "#e7eceb",
        border: "#e5ebe9",
        borderFocus: "#489588",
        teal: {
          DEFAULT: "#17766d",
          dark: "#11645c",
          light: "#e8f4f0",
        },
        bg: "#f5f7f6",
        surface: "#ffffff",
        surfaceHover: "#f6f8f7",
        status: {
          waiting: { bg: "#fff0ef", text: "#c74742" },
          verified: { bg: "#fff6df", text: "#a87712" },
          issued: { bg: "#edf6ef", text: "#54896a" },
        },
        dark: {
          bg: "#0c0b09",
          surface: "#161a18",
          surfaceHover: "#1f2624",
          border: "#2a3331",
          ink: "#e8edea",
          muted: "#9aa8a6",
          line: "#2a3331",
        },
      },
      fontFamily: {
        sans: ["Aptos", "Segoe UI", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["8px", { lineHeight: "1.2" }],
        sm: ["9px", { lineHeight: "1.3" }],
        base: ["10px", { lineHeight: "1.4" }],
        lg: ["11px", { lineHeight: "1.4" }],
        xl: ["12px", { lineHeight: "1.5" }],
        "2xl": ["16px", { lineHeight: "1.5" }],
        "3xl": ["20px", { lineHeight: "1.4" }],
        "4xl": ["30px", { lineHeight: "1.2" }],
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        6: "24px",
        8: "32px",
      },
      borderRadius: {
        sm: "3px",
        md: "5px",
        lg: "8px",
      },
      boxShadow: {
        sm: "0 1px 3px rgb(22 46 45 / 8%)",
        md: "0 4px 12px rgb(22 46 45 / 10%)",
        lg: "0 18px 55px rgb(22 46 45 / 17%)",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  darkMode: "class",
  plugins: [],
};