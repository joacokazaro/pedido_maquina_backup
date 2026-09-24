import prisma from "../db/prisma.js";
import { TIPO_ESPACIOS_VERDES } from "./tipoServicio.service.js";
import {
  LABEL_TRABAJO,
  LABEL_UNIDAD,
  UNIDAD_CANONICA_POR_TRABAJO,
  duracionEnDias,
  horasDelEventual,
  litrosCombustible,
  parseJson,
  produccionCanonica,
  redondear,
  resumenEstadistico,
} from "./kpiEspaciosVerdes.service.js";

/**
 * Comparador de eventuales de Espacios Verdes finalizados: un versus entre dos
 * y un buscador de similitud. Ambos parten del mismo perfil normalizado del
 * eventual (`armarPerfil`), así lo que se compara es siempre lo mismo.
 */

const UMBRAL_POR_DEFECTO = 60;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const LABEL_INSUMO = {
  NAFTA_PREPARADA: "Nafta preparada",
  NAFTA_PURA: "Nafta pura",
  BOLSAS: "Bolsas",
  TANZA: "Tanza",
  ACEITE_CADENA_MOTOSIERRA: "Aceite de cadena",
  GASOIL_PREMIUM: "Gasoil premium",
  GASOIL_COMUN: "Gasoil común",
  HERBICIDA: "Herbicida",
  OTRO: "Otro",
};

const LABEL_UNIDAD_INSUMO = { LITROS: "litros", UNIDADES: "unidades", METROS: "metros", CC: "cc" };

function buildError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizarClave(valor) {
  return String(valor || "").trim().toLowerCase();
}

function sumarPor(items, obtenerClave, obtenerCantidad) {
  const mapa = new Map();
  for (const item of items) {
    const clave = obtenerClave(item);
    if (!clave) continue;
    const cantidad = Number(obtenerCantidad(item)) || 0;
    mapa.set(clave, (mapa.get(clave) || 0) + cantidad);
  }
  return mapa;
}

/* =======================
   Perfil del eventual
======================= */

function personasDistintas(browix) {
  if (!Array.isArray(browix?.personas)) return null;
  const legajos = new Set(browix.personas.map((p) => p?.legajo).filter(Boolean).map(String));
  return legajos.size > 0 ? legajos.size : null;
}

async function cargarVehiculos(eventuales) {
  const ids = new Set();
  for (const e of eventuales) {
    const lista = parseJson(e.vehiculosUtilizados);
    if (Array.isArray(lista)) lista.forEach((id) => ids.add(String(id)));
  }
  if (ids.size === 0) return new Map();

  const filas = await prisma.vehiculo.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, vehiculo: true },
  });
  return new Map(filas.map((f) => [f.id, f.vehiculo]));
}

function armarPerfil(eventual, vehiculosPorId) {
  const browix = parseJson(eventual.horasBrowix);
  const dias = duracionEnDias(eventual);
  const horas = horasDelEventual(eventual);
  const personas = personasDistintas(browix);
  const jornadas = Number(browix?.cantidadFichajes);
  const inicio = eventual.fechaInicio ? new Date(eventual.fechaInicio) : null;

  const trabajosCrudos = parseJson(eventual.trabajosRealizados);
  const trabajos = Array.isArray(trabajosCrudos) ? trabajosCrudos : [];
  const maquinasCrudas = parseJson(eventual.maquinasUtilizadas);
  const maquinas = Array.isArray(maquinasCrudas) ? maquinasCrudas : [];
  const vehiculoIds = parseJson(eventual.vehiculosUtilizados);
  const vehiculos = (Array.isArray(vehiculoIds) ? vehiculoIds : []).map((id) => vehiculosPorId.get(String(id)) || "Vehículo");
  const insumosCrudos = parseJson(eventual.insumosExtras);
  const insumos = Array.isArray(insumosCrudos) ? insumosCrudos : [];
  const importados = parseJson(eventual.insumosImportados);
  const servicios = parseJson(eventual.serviciosExtrasSubcontratados);

  // Producción en unidad canónica por tipo de trabajo: es lo que se puede
  // comparar entre eventuales. Lo cargado en otra unidad queda afuera, igual
  // que en los KPI.
  const trabajosCanonicos = {};
  for (const tipo of Object.keys(UNIDAD_CANONICA_POR_TRABAJO)) {
    const cantidad = produccionCanonica(eventual, tipo);
    if (cantidad !== null) trabajosCanonicos[tipo] = cantidad;
  }

  return {
    id: eventual.id,
    nombre: eventual.nombre,
    supervisor: eventual.supervisor?.nombre || eventual.supervisor?.username || null,
    observaciones: eventual.observaciones || null,
    fechaInicio: eventual.fechaInicio,
    fechaFin: eventual.fechaFin,
    dias,
    mes: inicio && !Number.isNaN(inicio.getTime()) ? inicio.getUTCMonth() + 1 : null,
    personas,
    horas: horas === null ? null : redondear(horas, 1),
    jornadas: Number.isFinite(jornadas) && jornadas > 0 ? jornadas : null,
    categorias: (Array.isArray(browix?.categorias) ? browix.categorias : []).map((c) => ({
      categoria: c?.categoria || "Sin categoría",
      horas: redondear(Number(c?.totalHoras) || 0, 1),
      personas: Number(c?.cantidadPersonas) || null,
    })),
    trabajosCargados: trabajos.length,
    trabajos: trabajos
      .filter((t) => t?.tipo && Number(t.cantidad) > 0)
      .map((t) => ({
        tipo: t.tipo,
        etiqueta: t.tipo === "OTRO" && t.descripcionOtro ? `Otro: ${t.descripcionOtro}` : LABEL_TRABAJO[t.tipo] || t.tipo,
        unidad: t.unidadMedida,
        cantidad: Number(t.cantidad),
      })),
    trabajosCanonicos,
    maquinas: Object.fromEntries(sumarPor(maquinas, (m) => String(m?.tipo || "").trim(), (m) => m.cantidad)),
    vehiculos: Object.fromEntries(sumarPor(vehiculos, (v) => v, () => 1)),
    insumos: insumos
      .filter((i) => i?.tipo && Number(i.cantidad) > 0)
      .map((i) => ({
        tipo: i.tipo,
        etiqueta: LABEL_INSUMO[i.tipo] || i.tipo,
        unidad: i.unidadMedida,
        cantidad: Number(i.cantidad),
      })),
    combustibleLitros: litrosCombustible(eventual),
    insumosImportadosMonto: Number.isFinite(Number(importados?.total)) && Number(importados.total) > 0 ? Number(importados.total) : null,
    serviciosExtras: Array.isArray(servicios) ? servicios.length : 0,
    horasSupervisor: eventual.horasSupervisor ?? null,
    pedidosComplementarios: eventual._count?.pedidos ?? 0,
  };
}

const SELECT_EVENTUAL = {
  id: true,
  nombre: true,
  estado: true,
  observaciones: true,
  fechaInicio: true,
  fechaFin: true,
  horasBrowix: true,
  trabajosRealizados: true,
  maquinasUtilizadas: true,
  vehiculosUtilizados: true,
  insumosExtras: true,
  insumosImportados: true,
  serviciosExtrasSubcontratados: true,
  horasSupervisor: true,
  supervisor: { select: { username: true, nombre: true } },
  _count: { select: { pedidos: true } },
};

function finalizadosEV(extra = {}) {
  return { tipo: TIPO_ESPACIOS_VERDES, activo: true, estado: "finalizado", ...extra };
}

/* =======================
   Candidatos y catálogo
======================= */

export async function getCandidatosComparador() {
  const eventuales = await prisma.eventual.findMany({
    where: finalizadosEV(),
    select: SELECT_EVENTUAL,
    orderBy: { fechaInicio: "desc" },
  });
  const vehiculosPorId = await cargarVehiculos(eventuales);
  const perfiles = eventuales.map((e) => armarPerfil(e, vehiculosPorId));

  const tiposMaquina = new Set();
  const tiposVehiculo = new Set();
  for (const p of perfiles) {
    Object.keys(p.maquinas).forEach((t) => tiposMaquina.add(t));
    Object.keys(p.vehiculos).forEach((t) => tiposVehiculo.add(t));
  }

  return {
    eventuales: perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      supervisor: p.supervisor,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
    })),
    catalogo: {
      trabajos: Object.entries(UNIDAD_CANONICA_POR_TRABAJO).map(([tipo, unidad]) => ({
        tipo,
        etiqueta: LABEL_TRABAJO[tipo] || tipo,
        unidad,
        unidadLabel: LABEL_UNIDAD[unidad] || unidad,
      })),
      maquinas: Array.from(tiposMaquina).sort((a, b) => a.localeCompare(b)),
      vehiculos: Array.from(tiposVehiculo).sort((a, b) => a.localeCompare(b)),
      meses: MESES.map((nombre, i) => ({ valor: i + 1, nombre })),
    },
  };
}

/* =======================
   Versus
======================= */

function fila(etiqueta, a, b, { unidad = null, texto = false, rellenarCero = false } = {}) {
  if (texto) return { etiqueta, tipo: "texto", a: a ?? null, b: b ?? null };

  const va = a ?? (rellenarCero ? 0 : null);
  const vb = b ?? (rellenarCero ? 0 : null);
  const hayAmbos = va !== null && vb !== null;

  return {
    etiqueta,
    tipo: "numero",
    unidad,
    a: va === null ? null : redondear(va, 2),
    b: vb === null ? null : redondear(vb, 2),
    diferencia: hayAmbos ? redondear(vb - va, 2) : null,
    porcentaje: hayAmbos && va !== 0 ? redondear(((vb - va) / va) * 100, 1) : null,
  };
}

function filasUnion(mapaA, mapaB, { etiqueta = (k) => k, unidad = null } = {}) {
  const claves = Array.from(new Set([...mapaA.keys(), ...mapaB.keys()])).sort((x, y) => x.localeCompare(y));
  return claves.map((k) => fila(etiqueta(k), mapaA.get(k), mapaB.get(k), { unidad: typeof unidad === "function" ? unidad(k) : unidad, rellenarCero: true }));
}

const fechaCorta = (f) => (f ? new Date(f).toISOString().slice(0, 10) : null);

export async function compararEventuales(idA, idB) {
  const a = Number(idA);
  const b = Number(idB);
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw buildError("Indicá los dos eventuales a comparar");
  if (a === b) throw buildError("Elegí dos eventuales distintos");

  const eventuales = await prisma.eventual.findMany({
    where: { id: { in: [a, b] } },
    select: { ...SELECT_EVENTUAL, tipo: true },
  });
  const ea = eventuales.find((e) => e.id === a);
  const eb = eventuales.find((e) => e.id === b);
  if (!ea || !eb) throw buildError("Eventual no encontrado", 404);

  for (const e of [ea, eb]) {
    if (e.tipo !== TIPO_ESPACIOS_VERDES || e.estado !== "finalizado") {
      throw buildError(`"${e.nombre}" no es un eventual finalizado de Espacios Verdes`);
    }
  }

  const vehiculosPorId = await cargarVehiculos([ea, eb]);
  const pa = armarPerfil(ea, vehiculosPorId);
  const pb = armarPerfil(eb, vehiculosPorId);

  const dotacion = (p) => (p.jornadas && p.dias ? p.jornadas / p.dias : null);
  const horasPorJornada = (p) => (p.jornadas && p.horas ? p.horas / p.jornadas : null);

  const mapaCategorias = (p) => new Map(p.categorias.map((c) => [c.categoria, c.horas]));
  const mapaTrabajos = (p) => sumarPor(p.trabajos.filter((t) => t.tipo !== "OTRO"), (t) => `${t.tipo}|${t.unidad}`, (t) => t.cantidad);
  const mapaInsumos = (p) => sumarPor(p.insumos, (i) => `${i.tipo}|${i.unidad}`, (i) => i.cantidad);
  const mapaObj = (o) => new Map(Object.entries(o));

  const [tipoEtiqueta, unidadEtiqueta] = [(k) => k.split("|")[0], (k) => k.split("|")[1]];
  const etiquetaTrabajo = (k) => `${LABEL_TRABAJO[tipoEtiqueta(k)] || tipoEtiqueta(k)}`;
  const unidadTrabajo = (k) => LABEL_UNIDAD[unidadEtiqueta(k)] || unidadEtiqueta(k);
  const etiquetaInsumo = (k) => LABEL_INSUMO[tipoEtiqueta(k)] || tipoEtiqueta(k);
  const unidadInsumo = (k) => LABEL_UNIDAD_INSUMO[unidadEtiqueta(k)] || unidadEtiqueta(k);

  const secciones = [
    {
      titulo: "General",
      filas: [
        fila("Supervisor", pa.supervisor, pb.supervisor, { texto: true }),
        fila("Fecha de inicio", fechaCorta(pa.fechaInicio), fechaCorta(pb.fechaInicio), { texto: true }),
        fila("Fecha de fin", fechaCorta(pa.fechaFin), fechaCorta(pb.fechaFin), { texto: true }),
        fila("Mes de inicio", pa.mes ? MESES[pa.mes - 1] : null, pb.mes ? MESES[pb.mes - 1] : null, { texto: true }),
        fila("Duración", pa.dias, pb.dias, { unidad: "días" }),
        fila("Pedidos complementarios", pa.pedidosComplementarios, pb.pedidosComplementarios),
      ],
    },
    {
      titulo: "Personal",
      filas: [
        fila("Personas", pa.personas, pb.personas),
        fila("Horas-hombre", pa.horas, pb.horas, { unidad: "hs" }),
        fila("Jornadas", pa.jornadas, pb.jornadas),
        fila("Dotación", dotacion(pa), dotacion(pb), { unidad: "pers./día" }),
        fila("Horas por jornada", horasPorJornada(pa), horasPorJornada(pb), { unidad: "hs" }),
        fila("Horas del supervisor", pa.horasSupervisor, pb.horasSupervisor, { unidad: "hs" }),
      ],
    },
    { titulo: "Horas por categoría", filas: filasUnion(mapaCategorias(pa), mapaCategorias(pb), { unidad: "hs" }) },
    { titulo: "Trabajos realizados", filas: filasUnion(mapaTrabajos(pa), mapaTrabajos(pb), { etiqueta: etiquetaTrabajo, unidad: unidadTrabajo }) },
    { titulo: "Máquinas", filas: filasUnion(mapaObj(pa.maquinas), mapaObj(pb.maquinas), { unidad: "u." }) },
    { titulo: "Vehículos", filas: filasUnion(mapaObj(pa.vehiculos), mapaObj(pb.vehiculos), { unidad: "u." }) },
    {
      titulo: "Insumos",
      filas: [
        fila("Combustible total", pa.combustibleLitros, pb.combustibleLitros, { unidad: "litros" }),
        ...filasUnion(mapaInsumos(pa), mapaInsumos(pb), { etiqueta: etiquetaInsumo, unidad: unidadInsumo }),
        fila("Insumos importados (monto)", pa.insumosImportadosMonto, pb.insumosImportadosMonto, { unidad: "$" }),
        fila("Servicios extra subcontratados", pa.serviciosExtras, pb.serviciosExtras),
      ],
    },
  ].filter((s) => s.filas.length > 0);

  const agruparPorUnidad = (filas) => {
    const porUnidad = new Map();
    for (const f of filas) {
      if (!f.unidad || (f.a === 0 && f.b === 0)) continue;
      const lista = porUnidad.get(f.unidad) || [];
      lista.push({ etiqueta: f.etiqueta, a: f.a ?? 0, b: f.b ?? 0 });
      porUnidad.set(f.unidad, lista);
    }
    return Array.from(porUnidad.entries()).map(([unidad, datos]) => ({ unidad, datos }));
  };
  const seccion = (titulo) => secciones.find((s) => s.titulo === titulo)?.filas || [];

  return {
    a: { id: pa.id, nombre: pa.nombre },
    b: { id: pb.id, nombre: pb.nombre },
    secciones,
    graficos: {
      categorias: seccion("Horas por categoría").map((f) => ({ etiqueta: f.etiqueta, a: f.a ?? 0, b: f.b ?? 0 })),
      trabajos: agruparPorUnidad(seccion("Trabajos realizados")),
      insumos: agruparPorUnidad(seccion("Insumos").filter((f) => f.etiqueta !== "Insumos importados (monto)")),
    },
  };
}

/* =======================
   Buscador de similitud
======================= */

/** Menor ÷ mayor, de 0 a 1. Si alguno es 0 o falta, no hay parecido. */
function razon(pedido, real) {
  if (!(pedido > 0) || !(real > 0)) return 0;
  return Math.min(pedido, real) / Math.max(pedido, real);
}

/** Cercanía de dos meses en círculo: diciembre queda a un mes de enero. */
function cercaniaMes(pedido, real) {
  const distancia = Math.abs(pedido - real);
  return 1 - Math.min(distancia, 12 - distancia) / 6;
}

function normalizarBusqueda(body = {}) {
  const numeroPositivo = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const lista = (v, validarTipo) =>
    (Array.isArray(v) ? v : [])
      .map((i) => ({ tipo: String(i?.tipo || "").trim(), cantidad: numeroPositivo(i?.cantidad) }))
      .filter((i) => i.tipo && i.cantidad !== null && validarTipo(i.tipo));

  const trabajos = lista(body.trabajos, (t) => t in UNIDAD_CANONICA_POR_TRABAJO);
  const maquinas = lista(body.maquinas, () => true);
  const vehiculos = lista(body.vehiculos, () => true);
  const dias = numeroPositivo(body.dias);
  const personas = numeroPositivo(body.personas);
  const mes = Number(body.mes);
  const umbral = body.umbral === undefined || body.umbral === "" ? UMBRAL_POR_DEFECTO : Number(body.umbral);

  if (!Number.isFinite(umbral) || umbral < 0 || umbral > 100) throw buildError("El umbral debe estar entre 0 y 100");

  const busqueda = {
    trabajos,
    maquinas,
    vehiculos,
    dias,
    personas,
    mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : null,
    umbral,
  };

  const hayParametros =
    trabajos.length > 0 || maquinas.length > 0 || vehiculos.length > 0 || dias !== null || personas !== null || busqueda.mes !== null;
  if (!hayParametros) throw buildError("Ingresá al menos un parámetro para buscar");

  return busqueda;
}

/**
 * Similitud de un perfil contra la búsqueda, por grupo de parámetros. Un grupo
 * que el eventual no tiene cargado no se evalúa (no cuenta como cero): el
 * resultado informa cuántos grupos pudieron evaluarse.
 */
function evaluarSimilitud(perfil, busqueda) {
  const grupos = [];

  if (busqueda.trabajos.length > 0 && perfil.trabajosCargados > 0) {
    const partes = busqueda.trabajos.map((t) => razon(t.cantidad, perfil.trabajosCanonicos[t.tipo] || 0));
    grupos.push({ clave: "trabajos", label: "Trabajos", valor: partes.reduce((a, b) => a + b, 0) / partes.length });
  }
  if (busqueda.dias !== null && perfil.dias !== null) {
    grupos.push({ clave: "dias", label: "Duración", valor: razon(busqueda.dias, perfil.dias) });
  }
  if (busqueda.personas !== null && perfil.personas !== null) {
    grupos.push({ clave: "personas", label: "Cuadrilla", valor: razon(busqueda.personas, perfil.personas) });
  }
  const equiposPedidos = busqueda.maquinas.length + busqueda.vehiculos.length;
  const tieneEquipos = Object.keys(perfil.maquinas).length + Object.keys(perfil.vehiculos).length > 0;
  if (equiposPedidos > 0 && tieneEquipos) {
    const buscar = (mapa, tipo) => {
      const clave = normalizarClave(tipo);
      const encontrada = Object.keys(mapa).find((k) => normalizarClave(k) === clave);
      return encontrada ? mapa[encontrada] : 0;
    };
    const partes = [
      ...busqueda.maquinas.map((m) => razon(m.cantidad, buscar(perfil.maquinas, m.tipo))),
      ...busqueda.vehiculos.map((v) => razon(v.cantidad, buscar(perfil.vehiculos, v.tipo))),
    ];
    grupos.push({ clave: "equipos", label: "Máquinas y vehículos", valor: partes.reduce((a, b) => a + b, 0) / partes.length });
  }
  if (busqueda.mes !== null && perfil.mes !== null) {
    grupos.push({ clave: "epoca", label: "Época del año", valor: cercaniaMes(busqueda.mes, perfil.mes) });
  }

  if (grupos.length === 0) return null;

  const pedidos = [
    busqueda.trabajos.length > 0,
    busqueda.dias !== null,
    busqueda.personas !== null,
    equiposPedidos > 0,
    busqueda.mes !== null,
  ].filter(Boolean).length;

  return {
    similitud: redondear((grupos.reduce((a, g) => a + g.valor, 0) / grupos.length) * 100, 1),
    evaluados: grupos.length,
    pedidos,
    grupos: grupos.map((g) => ({ clave: g.clave, label: g.label, similitud: redondear(g.valor * 100, 1) })),
  };
}

function armarEstimacion(coincidencias) {
  const perfiles = coincidencias.map((c) => c.perfil);
  const resumen = (valores) => resumenEstadistico(valores.filter((v) => v !== null && v !== undefined));

  const porEquipo = new Map();
  for (const p of perfiles) {
    for (const [tipo, cantidad] of Object.entries({ ...p.maquinas, ...p.vehiculos })) {
      const actual = porEquipo.get(tipo) || { tipo, eventuales: 0, cantidades: [] };
      actual.eventuales += 1;
      actual.cantidades.push(cantidad);
      porEquipo.set(tipo, actual);
    }
  }

  return {
    base: perfiles.length,
    personas: resumen(perfiles.map((p) => p.personas)),
    dias: resumen(perfiles.map((p) => p.dias)),
    horas: resumen(perfiles.map((p) => p.horas)),
    combustibleLitros: resumen(perfiles.map((p) => p.combustibleLitros)),
    equipos: Array.from(porEquipo.values())
      .map((e) => ({
        tipo: e.tipo,
        eventuales: e.eventuales,
        presencia: redondear((e.eventuales / perfiles.length) * 100, 1),
        cantidadMediana: resumenEstadistico(e.cantidades).mediana,
      }))
      .sort((x, y) => y.eventuales - x.eventuales)
      .slice(0, 8),
  };
}

export async function buscarSimilares(body) {
  const busqueda = normalizarBusqueda(body);

  const eventuales = await prisma.eventual.findMany({ where: finalizadosEV(), select: SELECT_EVENTUAL });
  const vehiculosPorId = await cargarVehiculos(eventuales);

  const evaluados = [];
  for (const eventual of eventuales) {
    const perfil = armarPerfil(eventual, vehiculosPorId);
    const similitud = evaluarSimilitud(perfil, busqueda);
    if (similitud) evaluados.push({ perfil, ...similitud });
  }

  const coincidencias = evaluados.filter((e) => e.similitud >= busqueda.umbral).sort((a, b) => b.similitud - a.similitud);

  return {
    busqueda,
    totalEvaluados: evaluados.length,
    totalFinalizados: eventuales.length,
    resultados: coincidencias.map((c) => ({
      id: c.perfil.id,
      nombre: c.perfil.nombre,
      supervisor: c.perfil.supervisor,
      fechaInicio: c.perfil.fechaInicio,
      similitud: c.similitud,
      evaluados: c.evaluados,
      pedidos: c.pedidos,
      grupos: c.grupos,
      resumen: {
        dias: c.perfil.dias,
        personas: c.perfil.personas,
        horas: c.perfil.horas,
        mes: c.perfil.mes ? MESES[c.perfil.mes - 1] : null,
        trabajos: c.perfil.trabajos.map((t) => `${t.etiqueta}: ${redondear(t.cantidad, 1)} ${LABEL_UNIDAD[t.unidad] || t.unidad}`),
      },
    })),
    estimacion: coincidencias.length > 0 ? armarEstimacion(coincidencias) : null,
  };
}
