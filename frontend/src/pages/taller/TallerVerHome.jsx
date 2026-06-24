import { Link } from "react-router-dom";

const ITEMS = [
  {
    title: "Ver Taller - Maquinas",
    description: "Consultar todas las maquinas actualmente en taller.",
    to: "/admin/taller/ver/maquinas",
    icon: "🛠",
  },
  {
    title: "Ver Taller - Vehiculos",
    description: "Consultar todos los vehiculos actualmente en taller.",
    to: "/admin/taller/ver/vehiculos",
    icon: "🚗",
  },
];

export default function TallerVerHome() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <div className="mx-auto mb-6 max-w-5xl">
        <Link to="/admin/taller" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow">
          ← Taller
        </Link>
      </div>

      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Ver Taller</h1>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">Selecciona el modulo que quieres consultar.</p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-2xl border border-gray-200 bg-white p-8 text-center shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-4 block text-5xl">{item.icon}</span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">{item.title}</h2>
            <p className="mx-auto text-sm text-gray-500 sm:max-w-md">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
