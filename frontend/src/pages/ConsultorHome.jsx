import { Link } from "react-router-dom";

export default function ConsultorHome() {
  const sections = [
    {
      title: "Máquinas",
      description: "Consulta el inventario de máquinas en modo lectura.",
      to: "/admin/maquinas",
      icon: "🛠",
    },
    {
      title: "Vehículos",
      description: "Consulta el inventario de vehículos en modo lectura.",
      to: "/admin/vehiculos",
      icon: "🚗",
    },
    {
      title: "Eventuales",
      description: "Visualiza eventuales y su detalle operativo.",
      to: "/admin/eventuales",
      icon: "🧰",
    },
    {
      title: "Servicios",
      description: "Consulta servicios y su composición en modo lectura.",
      to: "/admin/servicios",
      icon: "🏷",
    },
    {
      title: "Supervisores x Servicios",
      description: "Consulta asignaciones de servicios por supervisor.",
      to: "/admin/supervisores-servicios",
      icon: "🧩",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Panel de consultoría</h1>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          Accesos rápidos a los módulos habilitados para lectura.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className="group rounded-2xl border border-gray-200 bg-white p-8 text-center shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-4 block text-5xl">{section.icon}</span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">{section.title}</h2>
            <p className="mx-auto text-sm text-gray-500 sm:max-w-md">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
