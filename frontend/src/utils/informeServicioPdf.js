import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateOnly, formatDateTime } from "./date";

function safeText(value, fallback = "No informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatMonto(value) {
  return `$ ${Number(value ?? 0).toLocaleString("es-AR")}`;
}

function getTrabajoLabel(item) {
  if (item?.tipo === "OTRO") {
    return String(item?.descripcionOtro || item?.label || "").trim() || "Otro";
  }
  return item?.label || item?.tipo;
}

const TABLA_BASE = {
  margin: { left: 12, right: 12 },
  tableWidth: 186,
  headStyles: { fillColor: [240, 240, 240], textColor: [31, 41, 55] },
};

const COLUMNA_ETIQUETA = { fontStyle: "bold", cellWidth: 55, textColor: [31, 41, 55] };

// Las tablas de autoTable saltan de página solas; los títulos de sección no, así que se
// reserva lugar para el título y al menos una fila antes de dibujarlo.
function drawSectionTitle(doc, text, y) {
  let top = y;
  if (top > 262) {
    doc.addPage();
    top = 16;
  }
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(12, top, 186, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(text, 14, top + 5.4);
  return top + 10;
}

function drawEmptyNote(doc, text, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.text(text, 14, y);
  return y + 8;
}

function drawTable(doc, y, options) {
  autoTable(doc, { ...TABLA_BASE, startY: y, ...options });
  return (doc.lastAutoTable?.finalY || y) + 8;
}

function drawKeyValueTable(doc, y, body) {
  return drawTable(doc, y, {
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    body,
    columnStyles: { 0: COLUMNA_ETIQUETA, 1: { cellWidth: 131 } },
  });
}

const TABLA_DETALLE_STYLES = { font: "helvetica", fontSize: 8.7, cellPadding: 1.8 };

function agruparMaquinasPorTipo(maquinas) {
  const grupos = new Map();
  for (const maquina of maquinas) {
    const tipo = safeText(maquina?.tipo, "Sin tipo");
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo).push(maquina.id);
  }
  return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function buildMaquinariaRows(informe) {
  const rows = agruparMaquinasPorTipo(informe.maquinas || []).map(([tipo, ids]) => [
    `MÁQUINA · ${tipo}`,
    `Cantidad: ${ids.length} (${ids.join(", ")})`,
  ]);

  for (const vehiculo of informe.vehiculos || []) {
    rows.push([
      `VEHÍCULO · ${safeText(vehiculo?.vehiculo)}`,
      `ID ${safeText(vehiculo?.id)} · ${safeText(vehiculo?.modelo, "Sin modelo")} · ${safeText(vehiculo?.patente, "Sin patente")}`,
    ]);
  }

  return rows;
}

export function downloadInformeServicioPdf(informe) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text("INFORME DE SERVICIO", 105, 16, { align: "center" });

  const generatedAt = formatDateTime(new Date());
  const supervisores = (informe.supervisores || [])
    .map((supervisor) => supervisor.nombre || supervisor.username)
    .join(", ");

  let cursorY = drawSectionTitle(doc, "1. DATOS DEL SERVICIO", 24);
  cursorY = drawKeyValueTable(doc, cursorY, [
    ["Servicio", safeText(informe.servicio?.nombre)],
    ["Período", `${formatDateOnly(informe.fechaDesde)} al ${formatDateOnly(informe.fechaHasta)}`],
    ["Supervisores asignados", safeText(supervisores, "Sin asignar")],
  ]);

  cursorY = drawSectionTitle(doc, "2. PEDIDOS DEL PERÍODO", cursorY);
  const pedidos = informe.pedidos || [];
  if (pedidos.length === 0) {
    cursorY = drawEmptyNote(doc, "No se registran pedidos entregados en el período.", cursorY);
  } else {
    cursorY = drawTable(doc, cursorY, {
      styles: { ...TABLA_DETALLE_STYLES, fontSize: 8.2, cellPadding: 1.6, overflow: "linebreak" },
      head: [["Pedido", "Entrega", "Solicitante", "Estado", "Máquinas y vehículos"]],
      body: pedidos.map((pedido) => [
        pedido.id,
        formatDateTime(pedido.fechaEntrega),
        safeText(pedido.solicitante?.nombre || pedido.solicitante?.username, "-"),
        String(pedido.estado || "").replaceAll("_", " "),
        [
          ...pedido.maquinas.map((maquina) => `${maquina.tipo} ${maquina.id}`),
          ...pedido.vehiculos.map((vehiculo) => `${safeText(vehiculo.vehiculo, "Vehículo")} ${vehiculo.id}`),
        ].join(", ") || "-",
      ]),
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold" },
        1: { cellWidth: 28 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: 70 },
      },
    });
  }

  cursorY = drawSectionTitle(doc, "3. MAQUINARIA UTILIZADA", cursorY);
  const maquinariaRows = buildMaquinariaRows(informe);
  if (maquinariaRows.length === 0) {
    cursorY = drawEmptyNote(doc, "No se registran maquinarias o vehículos utilizados.", cursorY);
  } else {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Tipo de componente", "Descripción"]],
      body: maquinariaRows,
      columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" }, 1: { cellWidth: 126 } },
    });
  }

  cursorY = drawSectionTitle(doc, "4. TRABAJOS REALIZADOS", cursorY);
  const trabajos = informe.trabajosRealizados || [];
  if (trabajos.length === 0) {
    cursorY = drawEmptyNote(doc, "No se registran trabajos realizados.", cursorY);
  } else {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Trabajo / servicio", "Cantidad", "Unidad"]],
      body: trabajos.map((trabajo) => [
        safeText(getTrabajoLabel(trabajo)),
        String(trabajo?.cantidad ?? "-"),
        safeText(trabajo?.unidadLabel || trabajo?.unidadMedida, "-"),
      ]),
      columnStyles: {
        0: { cellWidth: 138, fontStyle: "bold" },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 28 },
      },
    });
  }

  cursorY = drawSectionTitle(doc, "5. SERVICIOS EXTRAS SUBCONTRATADOS", cursorY);
  const serviciosExtras = informe.serviciosExtrasSubcontratados || [];
  if (serviciosExtras.length === 0) {
    cursorY = drawEmptyNote(doc, "No se registran servicios extras subcontratados.", cursorY);
  } else {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Servicio extra", "Cantidad", "Unidad", "Precio (ARS)"]],
      body: serviciosExtras.map((servicio) => [
        safeText(servicio?.descripcion),
        String(servicio?.cantidad ?? "-"),
        safeText(servicio?.unidadLabel || servicio?.unidadMedida, "-"),
        servicio?.precio !== null && servicio?.precio !== undefined && servicio?.precio !== ""
          ? formatMonto(servicio.precio)
          : "-",
      ]),
      columnStyles: {
        0: { cellWidth: 106, fontStyle: "bold" },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 28 },
        3: { cellWidth: 32, halign: "right" },
      },
    });
  }

  cursorY = drawSectionTitle(doc, "6. HORAS DE BROWIX", cursorY);
  const horasBrowix = informe.horasBrowix || null;
  cursorY = drawKeyValueTable(doc, cursorY, [
    ["Horas de Browix", horasBrowix ? `${horasBrowix.totalHoras} hs` : "No se importaron"],
  ]);
  const categorias = Array.isArray(horasBrowix?.categorias) ? horasBrowix.categorias : [];
  if (categorias.length > 0) {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Categoría", "Personas", "Horas"]],
      body: categorias.map((cat) => [
        safeText(cat?.categoria, "Sin categoría"),
        String(cat?.cantidadPersonas ?? "-"),
        `${cat?.totalHoras ?? "-"} hs`,
      ]),
      columnStyles: {
        0: { cellWidth: 126, fontStyle: "bold" },
        1: { cellWidth: 30, halign: "right" },
        2: { cellWidth: 30, halign: "right" },
      },
    });
  }

  cursorY = drawSectionTitle(doc, "7. INSUMOS", cursorY);
  const insumosImportados = informe.insumosImportados || null;
  cursorY = drawKeyValueTable(doc, cursorY, [
    ["Total importado", insumosImportados ? formatMonto(insumosImportados.total) : "No se importaron"],
    ["Cantidad de pedidos", insumosImportados ? String(insumosImportados.cantidadPedidos) : "-"],
  ]);

  const insumosRows = Array.isArray(insumosImportados?.insumos) ? insumosImportados.insumos : [];
  if (insumosRows.length > 0) {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Insumo", "Cantidad", "Subtotal (ARS)"]],
      body: insumosRows.map((insumo) => [
        safeText(insumo?.insumo),
        String(insumo?.cantidad ?? "-"),
        formatMonto(insumo?.subtotal),
      ]),
      columnStyles: {
        0: { cellWidth: 120, fontStyle: "bold" },
        1: { cellWidth: 30, halign: "right" },
        2: { cellWidth: 36, halign: "right" },
      },
    });
  }

  const insumosExtras = informe.insumosExtras || [];
  if (insumosExtras.length > 0) {
    cursorY = drawTable(doc, cursorY, {
      styles: TABLA_DETALLE_STYLES,
      head: [["Insumo extra (carga manual)", "Cantidad", "Unidad"]],
      body: insumosExtras.map((insumo) => [
        safeText(getTrabajoLabel(insumo)),
        String(insumo?.cantidad ?? "-"),
        safeText(insumo?.unidadLabel || insumo?.unidadMedida, "-"),
      ]),
      columnStyles: {
        0: { cellWidth: 120, fontStyle: "bold" },
        1: { cellWidth: 30, halign: "right" },
        2: { cellWidth: 36 },
      },
    });
  }

  cursorY = drawSectionTitle(doc, "8. OBSERVACIONES", cursorY);
  const observaciones = informe.observaciones || [];
  if (observaciones.length === 0) {
    drawEmptyNote(doc, "No se registran observaciones.", cursorY);
  } else {
    drawTable(doc, cursorY, {
      styles: { ...TABLA_DETALLE_STYLES, fontSize: 8.2, cellPadding: 1.6, overflow: "linebreak" },
      head: [["Fecha", "Autor", "Observación"]],
      body: observaciones.map((obs) => [
        formatDateTime(obs?.fecha),
        safeText(obs?.autor, "-"),
        safeText(obs?.texto, "-"),
      ]),
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 32 }, 2: { cellWidth: 124 } },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Referencia informe: #${safeText(informe.id, "-")}`, 12, 288);
    doc.text(`Fecha de generación: ${generatedAt}`, 12, 292);
    doc.text(`Página ${page} de ${pageCount}`, 198, 292, { align: "right" });
  }

  const fileSuffix = slugify(informe.servicio?.nombre) || safeText(informe.id, "servicio");
  doc.save(`informe-servicio-${fileSuffix}.pdf`);
}
