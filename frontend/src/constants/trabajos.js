// Catálogos de carga manual de trabajos, servicios extras e insumos. Espejan las listas
// válidas de backend/src/services/eventuales.service.js (TIPOS_TRABAJO_VALIDOS,
// UNIDADES_MEDIDA_VALIDAS, TIPOS_INSUMO_EXTRA_VALIDOS, UNIDADES_INSUMO_VALIDAS).

export const TIPOS_TRABAJO = [
  { value: "PODA_MENOR_2M", label: "Poda < 2mtrs" },
  { value: "PODA_ALTURA", label: "Poda en altura" },
  { value: "RETIRO_PODA", label: "Retiro de poda" },
  { value: "DESMALEZADO", label: "Desmalezado" },
  { value: "DESMONTE", label: "Desmonte" },
  { value: "CORTE_CESPED", label: "Corte de cesped" },
  { value: "CORTE_BARRIDO", label: "Corte y barrido" },
  { value: "LIMPIEZA_INTEGRAL", label: "Limpieza integral" },
  { value: "OTRO", label: "Otro" },
];

export const UNIDADES = [
  { value: "UNIDAD", label: "Unidad" },
  { value: "M2", label: "M2" },
  { value: "M3", label: "M3" },
  { value: "METROS_LINEALES", label: "Metros lineales" },
  { value: "HORAS", label: "Horas" },
  { value: "KG", label: "Kilogramos" },
];

export const TIPOS_INSUMO_EXTRA = [
  { value: "NAFTA_PREPARADA", label: "Nafta preparada" },
  { value: "NAFTA_PURA", label: "Nafta pura" },
  { value: "BOLSAS", label: "Bolsas" },
  { value: "TANZA", label: "Tanza" },
  { value: "ACEITE_CADENA_MOTOSIERRA", label: "Aceite para cadena de motosierra" },
  { value: "GASOIL_PREMIUM", label: "Gasoil premium" },
  { value: "GASOIL_COMUN", label: "Gasoil común" },
  { value: "HERBICIDA", label: "Herbicida" },
  { value: "OTRO", label: "Otro" },
];

export const UNIDADES_INSUMO = [
  { value: "LITROS", label: "Litros" },
  { value: "UNIDADES", label: "Unidades" },
  { value: "METROS", label: "Metros" },
  { value: "CC", label: "Centímetros cúbicos" },
];
