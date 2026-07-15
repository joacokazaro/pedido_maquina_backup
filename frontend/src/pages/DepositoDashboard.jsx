import { useAuth } from "../context/AuthContext";
import PanelHome from "../components/PanelHome";

export default function DepositoDashboard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando usuario…
      </div>
    );
  }

  const sections = [
    {
      title: "Máquinas",
      description: "Revisá todas las máquinas y los préstamos activos de las que pertenecen a tus servicios.",
      to: "/deposito/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Pedidos a gestionar",
      description: "Accedé al listado operativo para preparar, entregar y confirmar devoluciones.",
      to: "/deposito/pedidos",
      icon: "pedidos",
      accent: "navy",
    },
    {
      title: "Máquinas en Servicio",
      description: "Consultá los servicios cargados y las máquinas asociadas, sin permisos de edición.",
      to: "/deposito/servicios",
      icon: "servicios",
      accent: "green",
    },
    {
      title: "Máquinas por Supervisor",
      description: "Seleccioná un supervisor y visualizá sus máquinas fijas por servicio y las temporales por pedido.",
      to: "/deposito/supervisores",
      icon: "usuarios",
      accent: "cyan",
    },
  ];

  return (
    <PanelHome
      title="Panel de depósito"
      subtitle="Gestioná pedidos, entregas y devoluciones, y consultá las máquinas de tus servicios."
      sections={sections}
    />
  );
}
