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
        // Paleta de visualización de datos (panel de estadísticas): la
        // paleta kazaro es monohue (azul/verde) y no alcanza para distinguir
        // 7-8 categorías ni para semáforos de alerta. Colores fijos, no
        // derivados de kazaro, con mapeo estático por dominio (nunca cíclico).
        viz: {
          good: "#0ca30c",
          warning: "#d97706",
          critical: "#dc2626",
          s1: "#2a78d6",
          s2: "#eb6834",
          s3: "#1baf7a",
          s4: "#eda100",
          s5: "#e87ba4",
          s6: "#008300",
          s7: "#4a3aa7",
          s8: "#e34948",
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
