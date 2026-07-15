import PanelHome from "../components/PanelHome";

export default function AdminHome() {
  const sections = [
    {
      title: "Máquinas",
      description: "Alta, baja, edición y estados del inventario de máquinas.",
      to: "/admin/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Vehículos",
      description: "Gestioná vehículos, seguros, conductores asignados y documentación.",
      to: "/admin/vehiculos",
      icon: "vehiculos",
      accent: "cyan",
    },
    {
      title: "Taller",
      description: "Ingresos y egresos de taller con operaciones masivas e historial.",
      to: "/admin/taller",
      icon: "taller",
      accent: "green",
    },
    {
      title: "Pedidos",
      description: "Visualizá y auditá pedidos, cambios de estado e historial operativo.",
      to: "/admin/pedidos",
      icon: "pedidos",
      accent: "navy",
    },
    {
      title: "Eventuales",
      description: "Gestioná componentes utilizados, historial de eventuales y el alta de nuevos registros.",
      to: "/admin/eventuales",
      icon: "eventuales",
      accent: "cyan",
    },
    {
      title: "Usuarios",
      description: "Gestioná altas, bajas, edición de perfiles y roles del sistema.",
      to: "/admin/usuarios",
      icon: "usuarios",
      accent: "blue",
    },
    {
      title: "Servicios",
      description: "Administrá servicios y la relación con máquinas asociadas.",
      to: "/admin/servicios",
      icon: "servicios",
      accent: "green",
    },
    {
      title: "Supervisores x Servicios",
      description: "Asigná rápidamente qué servicios puede operar cada supervisor.",
      to: "/admin/supervisores-servicios",
      icon: "supervisores",
      accent: "navy",
    },
  ];

  return (
    <PanelHome
      title="Panel de administración"
      subtitle="Gestioná máquinas, vehículos, pedidos y usuarios del sistema desde un solo lugar."
      sections={sections}
    />
  );
}
