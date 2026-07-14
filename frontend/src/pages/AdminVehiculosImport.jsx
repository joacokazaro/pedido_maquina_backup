import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const REQUIRED_COLUMNS = [
  "ID",
  "EMPRESA",
  "ESTADO",
  "VEHICULO",
  "PATENTE",
  "MODELO",
];

const OPTIONAL_COLUMNS = [
  "NUMERO_POLIZA",
  "MOTOR",
  "CHASIS",
  "TIPO_COBERTURA",
  "SEGURO",
  "TARJETA_VERDE",
  "VTO_SEGURO",
  "VTO_SEGURO_APLICA",
  "VTO_MATAFUEGO",
  "VTO_MATAFUEGO_APLICA",
  "VTO_ITV",
  "VTO_ITV_APLICA",
  "OBLEA_GNC",
  "OBLEA_GNC_APLICA",
  "PRUEBA_HIDRAULICA_GNC",
  "PRUEBA_HIDRAULICA_GNC_APLICA",
  "CONDUCTOR_USERNAME",
];

export default function AdminVehiculosImport() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  function downloadTemplate() {
    window.location.href = `${API_BASE}/admin/vehiculos/import/template`;
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError("");
  }

  async function handleImport() {
    if (!selectedFile) return;

    try {
      setImporting(true);
      setError("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`${API_BASE}/admin/vehiculos/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detalles = Array.isArray(data.detalles) ? `: ${data.detalles.join(" | ")}` : "";
        throw new Error((data.error || "Error importando vehículos") + detalles);
      }

      navigate("/admin/vehiculos");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error importando vehículos");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
      setSelectedFile(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-gray-900">Importar vehículos desde Excel</h1>
          <p className="mt-2 text-sm text-gray-600">
            Usá una planilla con encabezados en la primera fila. La importación se rechaza si faltan datos obligatorios,
            o si el ID o la patente están duplicados.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Descargar plantilla Excel
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:bg-amber-300"
            >
              Seleccionar archivo
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !selectedFile}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
            >
              {importing ? "Importando..." : "Comenzar importación"}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Archivo seleccionado: <b>{selectedFile?.name || "Ninguno"}</b>
          </p>
        </header>

        {error && (
          <div className="rounded-2xl bg-red-100 p-4 text-sm text-red-700 shadow">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Columnas base</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              {REQUIRED_COLUMNS.map((column) => (
                <li key={column} className="rounded-lg bg-gray-50 px-3 py-2 font-medium">
                  {column}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Columnas opcionales</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              {OPTIONAL_COLUMNS.map((column) => (
                <li key={column} className="rounded-lg bg-gray-50 px-3 py-2 font-medium">
                  {column}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Reglas de carga</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p><b>ESTADO:</b> usar <b>activo</b> o <b>baja</b>.</p>
            <p><b>TARJETA_VERDE:</b> acepta <b>TIENE</b>, <b>NO TIENE</b>, <b>SI</b>, <b>NO</b>, <b>1</b> o <b>0</b>.</p>
            <p><b>Campos *_APLICA:</b> usar <b>SI</b> o <b>NO</b>.</p>
            <p><b>Fechas:</b> conviene cargarlas como fecha real de Excel o en formato <b>DD/MM/AAAA</b>.</p>
            <p><b>NÚMERO_POLIZA:</b> podés usar también los encabezados <b>NRO_POLIZA</b> o <b>POLIZA</b>.</p>
            <p><b>SEGURO:</b> es opcional. Si no se informa, se guarda vacío.</p>
            <p><b>CONDUCTOR_USERNAME:</b> si se informa, debe existir ese usuario.</p>
          </div>
        </section>
      </div>
    </div>
  );
}