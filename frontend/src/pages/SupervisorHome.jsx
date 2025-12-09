import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function SupervisorHome() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:3000/pedidos/supervisor/${user.id}`)
      .then(res => res.json())
      .then(setPedidos);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Mis pedidos</h1>

      <Link
        to="/supervisor/pedido/nuevo"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Crear nuevo pedido
      </Link>

      <div className="mt-6 space-y-3">
        {pedidos.map(p => (
          <Link
            key={p.id}
            to={`/supervisor/pedido/${p.id}`}
            className="block bg-white p-4 shadow rounded"
          >
            <p><b>ID:</b> {p.id}</p>
            <p><b>Estado:</b> {p.estado}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
