import PanelHome from "../components/PanelHome";

export default function TallerHome() {
  const sections = [
    {
      title: "Máquinas",
      description: "Consultá y operá el módulo de máquinas.",
      to: "/admin/maquinas",
      icon: "maquinas",
      accent: "blue",
    },
    {
      title: "Vehículos",
      description: "Consultá y operá el módulo de vehículos.",
      to: "/admin/vehiculos",
      icon: "vehiculos",
      accent: "cyan",
    },
    {
      title: "Taller",
      description: "Registrá ingresos y egresos y consultá todo lo que está en taller.",
      to: "/admin/taller",
      icon: "taller",
      accent: "green",
    },
  ];

  return (
    <PanelHome
      title="Panel de taller"
      subtitle="Accesos rápidos para consulta y movimientos de ingreso o egreso de taller."
      sections={sections}
    />
  );
}
