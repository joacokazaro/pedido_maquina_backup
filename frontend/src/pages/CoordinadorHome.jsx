import PanelHome from "../components/PanelHome";

export default function CoordinadorHome() {
  const sections = [
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
