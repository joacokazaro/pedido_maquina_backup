import PanelHome from "../components/PanelHome";

export default function ConsultorHome() {
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
      description: "Visualizá eventuales y su detalle operativo.",
      to: "/admin/eventuales",
      icon: "eventuales",
      accent: "navy",
    },
    {
      title: "Servicios",
      description: "Consultá servicios y su composición en modo lectura.",
      to: "/admin/servicios",
      icon: "servicios",
      accent: "cyan",
    },
    {
      title: "Supervisores x Servicios",
      description: "Consultá las asignaciones de servicios por supervisor.",
      to: "/admin/supervisores-servicios",
      icon: "supervisores",
      accent: "blue",
    },
  ];

  return (
    <PanelHome
      title="Panel de consultoría"
      subtitle="Accesos rápidos a los módulos habilitados para lectura."
      sections={sections}
    />
  );
}
