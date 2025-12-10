import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      await login(username, password);
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">

      {/* 🟦 Título grande superior */}
      <h1 className="text-3xl font-extrabold text-gray-800 mb-8 tracking-wide text-center">
        SOLICITUD MÁQUINA BACKUP
      </h1>

      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-sm">
        
        {/* Título dentro del card */}
        <h2 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h2>

        {/* Error */}
        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-center">
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label className="text-sm font-medium">Usuario</label>
            <input
              type="text"
              className="w-full mt-1 p-2 border rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Contraseña</label>
            <input
              type="password"
              className="w-full mt-1 p-2 border rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold">
            Entrar
          </button>
        </form>

        {/* Sección explicativa */}
        <div className="text-center text-gray-600 text-sm leading-relaxed">
          <h3 className="font-semibold text-gray-700 mb-1">¿Qué es esta aplicación?</h3>
          <p>
            Este portal permite gestionar solicitudes de máquinas de backup
            de forma ordenada, trazable y eficiente para todo el equipo operativo.
          </p>
        </div>
      </div>
    </div>
  );
}
