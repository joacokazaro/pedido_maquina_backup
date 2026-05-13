import { Link } from "react-router-dom";

export default function AdminHome() {
  const sections = [
    {
      title: "Máquinas",
      description: "Alta, baja, edición y estados del inventario de máquinas.",
      to: "/admin/maquinas",
      icon: "🛠",
    },
    {
      title: "Pedidos",
      description: "Visualizá y auditá pedidos, cambios de estado e historial operativo.",
      to: "/admin/pedidos",
      icon: "🧾",
    },
    {
      title: "Usuarios",
      description: "Gestioná altas, bajas, edición de perfiles y roles del sistema.",
      to: "/admin/usuarios",
      icon: "👥",
    },
    {
      title: "Servicios",
      description: "Administrá servicios y la relación con máquinas asociadas.",
      to: "/admin/servicios",
      icon: "🏷",
    },
    {
      title: "Supervisores x Servicios",
      description: "Asigná rápidamente qué servicios puede operar cada supervisor.",
      to: "/admin/supervisores-servicios",
      icon: "🧩",
      featured: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">
          Panel de administración
        </h1>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          Gestioná máquinas, pedidos y usuarios del sistema.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className={[
              "group rounded-2xl border border-gray-200 bg-white p-8 text-center shadow transition hover:-translate-y-1 hover:shadow-lg",
              section.featured ? "sm:col-span-2" : "",
            ].join(" ")}
          >
            <span className="mb-4 block text-5xl">{section.icon}</span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">
              {section.title}
            </h2>
            <p className="mx-auto text-sm text-gray-500 sm:max-w-md">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
