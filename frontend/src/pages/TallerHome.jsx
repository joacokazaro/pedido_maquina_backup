import { Link } from "react-router-dom";

export default function TallerHome() {
  const sections = [
    {
      title: "Maquinas",
      description: "Consulta y opera el modulo de maquinas.",
      to: "/admin/maquinas",
      icon: "🛠",
    },
    {
      title: "Vehiculos",
      description: "Consulta y opera el modulo de vehiculos.",
      to: "/admin/vehiculos",
      icon: "🚗",
    },
    {
      title: "Taller",
      description: "Registrar ingresos/egresos y ver todo lo que esta en taller.",
      to: "/admin/taller",
      icon: "🏭",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Panel de taller</h1>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          Accesos rapidos para consulta y movimientos de ingreso o egreso de taller.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className="group rounded-2xl border border-gray-200 bg-white p-8 text-center shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-4 block text-5xl">
              {section.icon}
            </span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">{section.title}</h2>
            <p className="mx-auto text-sm text-gray-500 sm:max-w-md">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}