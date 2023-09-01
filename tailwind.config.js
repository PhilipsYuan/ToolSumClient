/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,vue,jsx,tsx}"],
  theme: {
    extend: {
      fontSize: {
        "4xl": ["4.25rem", "4.75rem"],
        "3xl": ["3.5rem", "4rem"],
        "2xl": ["2.375rem", "2.875rem"],
        "xl": ["1.875rem", "2.375rem"],
        "lg": ["1.25rem", "1.75rem"],
        "base": ["1rem", "1.5rem"],
        "sm": ["0.875rem", "1.375rem"],
        "xs": ["o.75rem", "1.25rem"],
      },
      colors: {
        // global grey
        "g": {
          1: "var(--g1-color)",
          2: "var(--g2-color)",
          3: "var(--g3-color)",
          4: "var(--g4-color)",
          5: "var(--g5-color)",
          6: "var(--g6-color)",
          7: "var(--g7-color)",
          8: "var(--g8-color)",
          9: "var(--g9-color)",
          10: "var(--g10-color)",
          11: "var(--g11-color)",
          12: "var(--g12-color)",
          13: "var(--g13-color)",
          14: "var(--g14-color)",
        }
      }
    },
  },
  plugins: [],
}

