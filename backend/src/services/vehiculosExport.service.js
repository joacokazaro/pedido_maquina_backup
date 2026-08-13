import prisma from "../db/prisma.js";

const VEHICULO_EXPORT_INCLUDE = {
  seguro: true,
  conductorActual: {
    select: { username: true, nombre: true },
  },
};

function formatDateForSpreadsheet(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export const VEHICULO_EXPORT_FIELDS = [
  ["id", "ID"],
  ["empresa", "EMPRESA"],
  ["estado", "ESTADO"],
  ["vehiculo", "VEHICULO"],
  ["patente", "PATENTE"],
  ["modelo", "MODELO"],
  ["numeroPoliza", "NUMERO_POLIZA"],
  ["motor", "MOTOR"],
  ["chasis", "CHASIS"],
  ["tipoCobertura", "TIPO_COBERTURA"],
  ["seguro", "SEGURO"],
  ["vtoSeguro", "VTO_SEGURO"],
  ["vtoSeguroAplica", "VTO_SEGURO_APLICA"],
  ["vtoMatafuego", "VTO_MATAFUEGO"],
  ["vtoMatafuegoAplica", "VTO_MATAFUEGO_APLICA"],
  ["vtoItv", "VTO_ITV"],
  ["vtoItvAplica", "VTO_ITV_APLICA"],
  ["obleaGnc", "OBLEA_GNC"],
  ["obleaGncAplica", "OBLEA_GNC_APLICA"],
  ["pruebaHidraulicaGnc", "PRUEBA_HIDRAULICA_GNC"],
  ["pruebaHidraulicaGncAplica", "PRUEBA_HIDRAULICA_GNC_APLICA"],
  ["tarjetaVerde", "TARJETA_VERDE"],
  ["conductorUsername", "CONDUCTOR_USERNAME"],
  ["conductorNombre", "CONDUCTOR_NOMBRE"],
];

export async function getVehiculosParaExport({ where } = {}) {
  const vehiculos = await prisma.vehiculo.findMany({
    where,
    include: VEHICULO_EXPORT_INCLUDE,
    orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
  });

  return { vehiculos };
}

export function buildVehiculoExportRecord(vehiculo) {
  return {
    id: vehiculo.id,
    empresa: vehiculo.empresa,
    estado: vehiculo.estado,
    vehiculo: vehiculo.vehiculo,
    patente: vehiculo.patente,
    modelo: vehiculo.modelo,
    numeroPoliza: vehiculo.numeroPoliza || "",
    motor: vehiculo.motor,
    chasis: vehiculo.chasis,
    tipoCobertura: vehiculo.tipoCobertura,
    seguro: vehiculo.seguro?.nombre || "",
    vtoSeguro: formatDateForSpreadsheet(vehiculo.vtoSeguro),
    vtoSeguroAplica: vehiculo.vtoSeguroAplica ? "SI" : "NO",
    vtoMatafuego: formatDateForSpreadsheet(vehiculo.vtoMatafuego),
    vtoMatafuegoAplica: vehiculo.vtoMatafuegoAplica ? "SI" : "NO",
    vtoItv: formatDateForSpreadsheet(vehiculo.vtoItv),
    vtoItvAplica: vehiculo.vtoItvAplica ? "SI" : "NO",
    obleaGnc: formatDateForSpreadsheet(vehiculo.obleaGnc),
    obleaGncAplica: vehiculo.obleaGncAplica ? "SI" : "NO",
    pruebaHidraulicaGnc: formatDateForSpreadsheet(vehiculo.pruebaHidraulicaGnc),
    pruebaHidraulicaGncAplica: vehiculo.pruebaHidraulicaGncAplica ? "SI" : "NO",
    tarjetaVerde: vehiculo.tarjetaVerde ? "TIENE" : "NO TIENE",
    conductorUsername: vehiculo.conductorActual?.username || "",
    conductorNombre: vehiculo.conductorActual?.nombre || "",
  };
}
