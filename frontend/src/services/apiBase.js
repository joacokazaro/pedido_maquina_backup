// src/services/apiBase.js
// PROD
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// local
//export const API_BASE = "http://localhost:3000";

