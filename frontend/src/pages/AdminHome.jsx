import { Link } from "react-router-dom";

const ACCENTS = {
  blue: {
    tile: "bg-kazaro-ice text-kazaro-blue",
    ring: "hover:ring-kazaro-sky/60",
    bar: "from-kazaro-blue to-kazaro-sky",
  },
  cyan: {
    tile: "bg-[#e0f7f8] text-[#0c9ca6]",
    ring: "hover:ring-kazaro-cyan/60",
    bar: "from-kazaro-cyan to-kazaro-aqua",
  },
  green: {
    tile: "bg-[#e9f6ec] text-[#3f9d59]",
    ring: "hover:ring-kazaro-green/60",
    bar: "from-kazaro-green to-kazaro-cyan",
  },
  navy: {
    tile: "bg-[#e8edf7] text-[#07447c]",
    ring: "hover:ring-kazaro-deep/40",
    bar: "from-kazaro-deep to-kazaro-blue",
  },
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
    case "taller":
      return (
        <svg {...common}>
          <path d="M3 21V10l6 3.5V10l6 3.5V10l6 3.5V21H3Z" />
          <path d="M7 17h2M11 17h2M15 17h2" />
        </svg>
      );
    case "pedidos":
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" />
          <path d="M9 3h6v3H9V3ZM9 11h6M9 15h4" />
        </svg>
      );
    case "eventuales":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2M3 13h18M12 12v3" />
        </svg>
      );
    case "usuarios":
      return (
        <svg {...common}>
          <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 5.8M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
        </svg>
      );
    case "servicios":
      return (
        <svg {...common}>
          <path d="M3 12V4h8l10 10-8 8L3 12Z" />
          <circle cx="8" cy="9" r="1.5" />
        </svg>
      );
    case "supervisores":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M17.5 14v7M14 17.5h7" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AdminHome() {
  const sections = [
    {
      title: "Máquinas",
      description: "Alta, baja, edición y estados del inventario de máquinas.",
      to: "/admin/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Vehículos",
      description: "Gestioná vehículos, seguros, conductores asignados y documentación.",
      to: "/admin/vehiculos",
      icon: "vehiculos",
      accent: "cyan",
    },
    {
      title: "Taller",
      description: "Ingresos y egresos de taller con operaciones masivas e historial.",
      to: "/admin/taller",
      icon: "taller",
      accent: "green",
    },
    {
      title: "Pedidos",
      description: "Visualizá y auditá pedidos, cambios de estado e historial operativo.",
      to: "/admin/pedidos",
      icon: "pedidos",
      accent: "navy",
    },
    {
      title: "Eventuales",
      description: "Gestioná componentes utilizados, historial de eventuales y el alta de nuevos registros.",
      to: "/admin/eventuales",
      icon: "eventuales",
      accent: "cyan",
    },
    {
      title: "Usuarios",
      description: "Gestioná altas, bajas, edición de perfiles y roles del sistema.",
      to: "/admin/usuarios",
      icon: "usuarios",
      accent: "blue",
    },
    {
      title: "Servicios",
      description: "Administrá servicios y la relación con máquinas asociadas.",
      to: "/admin/servicios",
      icon: "servicios",
      accent: "green",
    },
    {
      title: "Supervisores x Servicios",
      description: "Asigná rápidamente qué servicios puede operar cada supervisor.",
      to: "/admin/supervisores-servicios",
      icon: "supervisores",
      accent: "navy",
    },
  ];

  return (
    <div className="min-h-screen bg-kazaro-mist px-4 py-8 font-sans sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl bg-kazaro-navy px-8 py-12 text-white shadow-xl shadow-kazaro-navy/20 sm:px-12">
          <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-kazaro-blue/25" />
          <div className="pointer-events-none absolute -bottom-40 right-24 h-80 w-80 rounded-full bg-kazaro-cyan/20" />
          <div className="pointer-events-none absolute -bottom-48 -right-20 h-96 w-72 rotate-[28deg] rounded-[999px] bg-kazaro-green/25 blur-[1px]" />

          <div className="relative z-10 max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-kazaro-aqua/40 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-kazaro-aqua">
              Bien claro hacia el futuro
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              Panel de administración
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#d8e4f0]">
              Gestioná máquinas, vehículos, pedidos y usuarios del sistema desde un solo lugar.
            </p>
          </div>

          <img
            src="/LogoHorizFull.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-8 right-10 z-10 hidden w-64 opacity-90 brightness-0 invert lg:block"
          />
        </section>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => {
            const accent = ACCENTS[section.accent];
            return (
              <Link
                key={section.title}
                to={section.to}
                className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-1 hover:shadow-xl ${accent.ring}`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition group-hover:opacity-100 ${accent.bar}`}
                />
                <span
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition group-hover:scale-105 ${accent.tile}`}
                >
                  <Icon name={section.icon} className="h-6 w-6" />
                </span>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {section.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                  {section.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-kazaro-blue">
                  Ingresar
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>

        <footer className="mt-10 pb-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Kazaró · Limpieza · Parquización · Desinfección
        </footer>
      </div>
    </div>
  );
}
