import PanelHome from "../components/PanelHome";

export default function CoordinadorHome() {
  const sections = [
    {
      title: "Nuevo pedido",
      description: "Creá un pedido de máquinas a tu propio nombre, al depósito o a un supervisor.",
      to: "/supervisor/pedido/nuevo",
      icon: "pedidos",
      accent: "blue",
    },
    {
      title: "Mis pedidos",
      description: "Seguí los pedidos que realizaste y registrá sus devoluciones.",
      to: "/supervisor/pedidos",
      icon: "prestamos",
      accent: "navy",
    },
    {
      title: "Máquinas",
      description: "Consultá el inventario de máquinas en modo lectura.",
      to: "/admin/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Vehículos",
      description: "Consultá el inventario de vehículos en modo lectura.",
      to: "/admin/vehiculos",
      icon: "vehiculos",
      accent: "cyan",
    },
    {
      title: "Taller",
      description: "Visualizá ingresos y egresos de taller con su historial.",
      to: "/admin/taller",
      icon: "taller",
      accent: "green",
    },
    {
      title: "Eventuales",
      description: "Visualizá eventuales, su detalle operativo y las finalizaciones pendientes.",
      to: "/admin/eventuales",
      icon: "eventuales",
      accent: "navy",
    },
  ];

  return (
    <PanelHome
      title="Panel de coordinación"
      subtitle="Accesos rápidos a los módulos habilitados para coordinación."
      sections={sections}
    />
  );
}
