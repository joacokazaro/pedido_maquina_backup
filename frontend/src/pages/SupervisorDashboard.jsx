import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FondoKazaro from "../components/FondoKazaro";

const ACCENTS = {
  blue: "bg-kazaro-ice text-kazaro-blue",
  cyan: "bg-[#e0f7f8] text-[#0c9ca6]",
  green: "bg-[#e9f6ec] text-[#3f9d59]",
  navy: "bg-[#e8edf7] text-[#07447c]",
};

function Icon({ name, className }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "maquinas":
      return (
        <svg {...common}>
          <path d="M14.5 6.5a4.2 4.2 0 0 0-5.6 5.6L4 17l3 3 4.9-4.9a4.2 4.2 0 0 0 5.6-5.6l-2.6 2.6-2.5-2.5 2.6-2.6Z" />
          <path d="M17.5 14.5 21 18l-3 3-3.5-3.5" />
        </svg>
      );
    case "vehiculos":
      return (
        <svg {...common}>
          <path d="M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6Z" />
          <path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      );
    case "pedidos":
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" />
          <path d="M9 3h6v3H9V3ZM9 11h6M9 15h4" />
        </svg>
      );
    case "prestamos":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" />
          <path d="M4 4v4h4M20 20v-4h-4" />
        </svg>
      );
    case "eventuales":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2M3 13h18M12 12v3" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SupervisorDashboard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando usuario…
      </div>
    );
  }

  const secciones = [
    {
      title: "Mis máquinas",
      description: "Consultá tus máquinas y filtrá por servicio, estado o serie",
      to: "/supervisor/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Mis vehículos",
      description: "Revisá los vehículos asignados actualmente a tu usuario.",
      to: "/supervisor/vehiculos",
      icon: "vehiculos",
      accent: "cyan",
    },
    {
      title: "Mis pedidos",
      description: "Pedidos que realizaste al depósito o a otros supervisores",
      to: "/supervisor/pedidos",
      icon: "pedidos",
      accent: "navy",
    },
    {
      title: "Mis préstamos",
      description: "Pedidos que otros supervisores te realizaron",
      to: "/supervisor/prestamos",
      icon: "prestamos",
      accent: "green",
    },
    {
      title: "Mis eventuales",
      description: "Revisá los eventuales asignados y el detalle de componentes utilizados.",
      to: "/supervisor/eventuales",
      icon: "eventuales",
      accent: "cyan",
    },
  ];

  return (
    <div className="min-h-screen px-4 py-6 pb-16 font-sans sm:px-6">
      <FondoKazaro />

      <div className="mx-auto max-w-3xl">
        <section className="relative overflow-hidden rounded-3xl bg-kazaro-navy px-6 py-8 text-white shadow-xl shadow-kazaro-navy/20 sm:px-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-kazaro-blue/25" />
          <div className="pointer-events-none absolute -bottom-28 -right-10 h-56 w-56 rounded-full bg-kazaro-cyan/20" />
          <div className="pointer-events-none absolute -bottom-32 left-8 h-64 w-44 rotate-[28deg] rounded-[999px] bg-kazaro-green/25 blur-[1px]" />

          <div className="relative z-10">
            <img
              src="/LogoHorizFull.png"
              alt="Kazaró"
              className="mb-5 h-8 w-auto brightness-0 invert"
            />
            <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Hola, {user?.nombre || user?.username}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#d8e4f0]">
              Gestioná tus máquinas, vehículos, pedidos y eventuales desde acá.
            </p>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {secciones.map((seccion) => (
            <Link
              key={seccion.title}
              to={seccion.to}
              className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-kazaro-sky/50 active:scale-[0.99]"
            >
              <span
                className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl transition group-hover:scale-105 ${ACCENTS[seccion.accent]}`}
              >
                <Icon name={seccion.icon} className="h-6 w-6" />
              </span>

              <span className="min-w-0 flex-1">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {seccion.title}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {seccion.description}
                </p>
              </span>

              <svg
                className="h-5 w-5 flex-none text-slate-300 transition group-hover:translate-x-1 group-hover:text-kazaro-blue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>

        <footer className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
          Kazaró · Limpieza · Parquización · Desinfección
        </footer>
      </div>
    </div>
  );
}
