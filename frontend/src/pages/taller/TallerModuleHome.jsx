import { Link } from "react-router-dom";

const ITEMS = [
  {
    title: "Registrar Ingreso / Egreso",
    description: "Registra movimientos masivos de taller por modulo.",
    to: "/admin/taller/registrar",
    icon: "📝",
  },
  {
    title: "Ver Taller",
    description: "Consulta todo lo que actualmente esta en taller.",
    to: "/admin/taller/ver",
    icon: "🏭",
  },
];

export default function TallerModuleHome() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Taller</h1>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          Selecciona si quieres registrar movimientos o consultar lo que esta en taller.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-2xl border border-gray-200 bg-white p-8 text-center shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-4 block text-5xl">
              {item.icon}
            </span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">{item.title}</h2>
            <p className="mx-auto text-sm text-gray-500 sm:max-w-md">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
