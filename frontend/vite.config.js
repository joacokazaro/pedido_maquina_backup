import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth/, "/api/auth"),
      },
      "/maquinas": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/maquinas/, "/api/maquinas"),
      },
      "/pedidos": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/pedidos/, "/api/pedidos"),
      },
      "/servicios": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/servicios/, "/api/servicios"),
      },
      "/admin": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/admin/, "/api/admin"),
      },
      "/admin-users": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/admin-users/, "/api/admin-users"),
      },
      "/supervisores": {
        target: "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/supervisores/, "/api/supervisores"),
      },
    },
  },
});
