/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kazaro: {
          navy: "#07173b",
          deep: "#002a65",
          blue: "#1172c1",
          sky: "#4aa4e0",
          cyan: "#2bafc6",
          aqua: "#28e1e3",
          green: "#65bc7b",
          ice: "#e2f4ff",
          mist: "#f3f8fc",
        },
      },
      fontFamily: {
        sans: ["Barlow", "ui-sans-serif", "system-ui", "Arial", "sans-serif"],
        display: ["Raleway", "Barlow", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
