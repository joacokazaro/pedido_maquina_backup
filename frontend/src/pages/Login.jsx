import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-[#f3f8fc] px-4 py-6 text-[#0b1736]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1000px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-xl border border-[#d9e5ef] bg-white shadow-xl shadow-[#0a2446]/15 md:min-h-[590px] md:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-[#07173b] px-12 py-10 text-white md:flex md:flex-col">
            <div className="absolute -right-36 top-24 h-[390px] w-[390px] rounded-full bg-[#0b6da6]/20" />
            <div className="absolute -right-28 top-60 h-[300px] w-[300px] rounded-full bg-[#064d8b]/25" />
            <div className="absolute -bottom-44 right-16 h-[470px] w-[210px] rotate-[32deg] rounded-[999px] bg-[#08a98e]/35 blur-[1px]" />

            <div className="relative z-10 mt-16 max-w-[430px]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#06d7da]/40 bg-[#06314c]/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#28f2f1]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3.5 19 6v5.2c0 4.4-2.8 7.9-7 9.3-4.2-1.4-7-4.9-7-9.3V6l7-2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m9.2 12 1.8 1.8 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Plataforma interna
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.18] tracking-normal">
                Máquinas&nbsp; y&nbsp; vehículos
                <span className="mt-3 block">
                  grupo <span className="text-[#28e1e3]">Kazaró</span>
                </span>
              </h1>

              <p className="mt-5 max-w-[420px] text-base leading-7 text-[#d8e4f0]">
                Acceso centralizado para administrar máquinas, vehículos y seguimiento en tiempo real.
              </p>
            </div>

            <div className="relative z-10 mt-8 grid max-w-[480px] grid-cols-3 gap-6">
              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#173769] text-[#28e1e3] shadow-lg shadow-black/10">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M14 3v5h5M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold">Solicitudes</h3>
                <p className="mt-1 text-xs leading-5 text-[#d8e4f0]">
                  Gestioná préstamos de maquinaria.
                </p>
              </div>

              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#173769] text-[#28e1e3] shadow-lg shadow-black/10">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold">Flota</h3>
                <p className="mt-1 text-xs leading-5 text-[#d8e4f0]">
                  Control y seguimiento de vehículos.
                </p>
              </div>

              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#173769] text-[#28e1e3] shadow-lg shadow-black/10">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="m5 9 5-4 4 4 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold">Reportes</h3>
                <p className="mt-1 text-xs leading-5 text-[#d8e4f0]">
                  Métricas y reportes en tiempo real.
                </p>
              </div>
            </div>

            <img
              src="/LogoHorizFull.png"
              alt="Kazaró"
              className="relative z-10 ml-10 mr-auto mt-auto w-[295px] max-w-full brightness-0 invert"
            />
          </section>

          <main className="flex flex-col bg-white">
            <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
              <div className="w-full max-w-[360px]">
                <div className="mb-7 text-center md:hidden">
                  <img
                    src="/LogoHorizFull.png"
                    alt="Kazaró"
                    className="mx-auto mb-5 w-48 object-contain"
                  />
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0c9ca6]">
                  Plataforma interna
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-[#07173b]">
                    Máquinas y vehículos grupo Kazaró
                  </h1>
                </div>

                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[#edf4ff] text-[#2563eb]">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="mb-7 text-center">
                  <h2 className="text-3xl font-extrabold text-[#07173b]">Iniciar sesión</h2>
                  <p className="mt-2 text-sm text-[#63728a]">
                    Ingresá con tus credenciales para continuar.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#16264b]">
                      Usuario
                    </label>
                    <div className="flex h-12 items-center rounded-lg border border-[#c9d6e6] bg-white px-4 text-[#32425f] transition focus-within:border-[#1e88bd] focus-within:ring-4 focus-within:ring-[#dff7f6]">
                      <svg className="mr-3 h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Ingresa tu usuario"
                        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#16264b] outline-none placeholder:text-[#72819a]"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#16264b]">
                      Contraseña
                    </label>
                    <div className="flex h-12 items-center rounded-lg border border-[#c9d6e6] bg-white px-4 text-[#32425f] transition focus-within:border-[#1e88bd] focus-within:ring-4 focus-within:ring-[#dff7f6]">
                      <svg className="mr-3 h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingresa tu contraseña"
                        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#16264b] outline-none placeholder:text-[#72819a]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="ml-3 flex h-8 w-8 flex-none items-center justify-center rounded text-[#32425f] transition hover:bg-[#edf4ff] hover:text-[#2563eb] focus:outline-none focus:ring-2 focus:ring-blue-200"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                        {!showPassword && (
                          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        )}
                        </svg>
                      </button>
                    </div>
                  </div>

                  <button className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#2563eb] px-4 text-lg font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-4 focus:ring-blue-200">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M10 17 15 12l-5-5M15 12H3M15 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Ingresar
                  </button>
                </form>
              </div>
            </div>

            <footer className="border-t border-[#d8e2ee] px-6 py-5 text-center text-xs text-[#63728a]">
              <span className="inline-flex items-center gap-3">
                <svg className="h-5 w-5 text-[#63728a]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3.5 19 6v5.2c0 4.4-2.8 7.9-7 9.3-4.2-1.4-7-4.9-7-9.3V6l7-2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m9.2 12 1.8 1.8 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Acceso seguro al sistema de gestión.
              </span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
