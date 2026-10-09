import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { instalarDescargasConSesion, instalarSesionEnFetch } from "./services/sesion.js";

// Antes del primer render: toda llamada a la API lleva la sesión firmada.
instalarSesionEnFetch();
instalarDescargasConSesion();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
