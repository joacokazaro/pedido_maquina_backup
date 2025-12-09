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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  );
}
