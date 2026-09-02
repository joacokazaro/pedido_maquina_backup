import { useCallback, useEffect, useState } from "react";
import BotonVolver from "../../components/BotonVolver";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import Carrusel from "./components/Carrusel";
import SlideGenerales from "./components/SlideGenerales";
import SlideRendimiento from "./components/SlideRendimiento";
import SlideDotacion from "./components/SlideDotacion";
import SlideParqueEquipos from "./components/SlideParqueEquipos";

const FUENTE_HORAS = "Horas del sistema de marcación importadas al cerrar el eventual (campo horasBrowix).";

export default function AdminKpiEspaciosVerdes() {
  const { user } = useAuth();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/eventuales/kpis/espacios-verdes`, {
        headers: buildActorHeaders(user),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error obteniendo los KPIs");
      setDatos(data);
    } catch (e) {
      setError(e.message || "Error obteniendo los KPIs");
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10">
        <BotonVolver>Volver al panel</BotonVolver>
        <div className="mx-auto max-w-[1600px] animate-pulse space-y-4">
          <div className="h-32 rounded-3xl bg-white/80" />
          <div className="h-96 rounded-3xl bg-white/80" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10">
        <BotonVolver>Volver al panel</BotonVolver>
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-display text-lg font-bold text-red-800">No se pudieron cargar los indicadores</p>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={cargar}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { alcance, generales, rendimientos, dotacion, parqueEquipos } = datos;

  const slides = [
    {
      clave: "generales",
      titulo: "Generales",
      resumen:
        "Cuánto se produjo, con cuánta mano de obra y de qué calificación. Es la foto de la operación de Espacios Verdes sobre los eventuales ya cerrados.",
      contenido: <SlideGenerales alcance={alcance} generales={generales} />,
    },
    {
      clave: "desmalezado",
      titulo: "Desmalezado",
      resumen:
        "Cuántos metros cuadrados limpia una persona en una hora. Es la vara para saber si un trabajo se ejecutó bien o mal, y para cotizar el próximo.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.desmalezado}
          sentido="mas-es-mejor"
          formula="m² desmalezados ÷ horas-hombre del eventual"
          notas={[
            "Solo entran los trabajos de desmalezado cargados en m². Si alguno se cargó en otra unidad (por ejemplo en horas) queda afuera: no es una superficie mal etiquetada sino otra magnitud, y no hay forma de convertirla.",
          ]}
          fuente={FUENTE_HORAS}
        />
      ),
    },
    {
      clave: "retiroPoda",
      titulo: "Retiro de poda",
      resumen:
        "Cuánto volumen de ramas se retira por hora trabajada. Se mide en metros cúbicos, que es volumen retirado y no superficie.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.retiroPoda}
          sentido="mas-es-mejor"
          formula="m³ retirados ÷ horas-hombre del eventual"
          notas={[
            "Solo entran los retiros de poda cargados en m³, que es la unidad que corresponde al trabajo.",
          ]}
          fuente={FUENTE_HORAS}
        />
      ),
    },
    {
      clave: "combustible",
      titulo: "Combustible",
      resumen:
        "Cuánta nafta se quema por hora de trabajo. Acá más es peor: sirve para detectar derroche, pérdidas o carga mal registrada.",
      contenido: (
        <SlideRendimiento
          bloque={rendimientos.combustible}
          sentido="menos-es-mejor"
          formula="Litros de combustible ÷ horas-hombre del eventual"
          notas={[
            "Cuenta nafta preparada, nafta pura, gasoil premium y gasoil común cargados en litros. El aceite de cadena queda afuera porque se mide en cc y no es combustible.",
            "Son los litros que el supervisor cargó a mano en el eventual, no los que se importan de la plataforma de insumos.",
          ]}
          fuente="Campo insumosExtras del eventual, cruzado con las horas del sistema de marcación."
        />
      ),
    },
    {
      clave: "dotacion",
      titulo: "Dotación",
      resumen:
        "Cuánta gente hubo por día y cuánto duró cada trabajo. Permite dimensionar la cuadrilla del próximo eventual sin adivinar.",
      contenido: <SlideDotacion dotacion={dotacion} />,
    },
    {
      clave: "parqueEquipos",
      titulo: "Parque de equipos",
      resumen:
        "Qué maquinaria sostiene realmente la operación y en qué cantidades. Orienta dónde invertir y qué reponer.",
      contenido: <SlideParqueEquipos parqueEquipos={parqueEquipos} />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <BotonVolver>Volver al panel</BotonVolver>

      <header className="mx-auto mb-7 max-w-[1600px] overflow-hidden rounded-3xl bg-gradient-to-br from-kazaro-navy via-kazaro-deep to-[#0a4a63] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-11">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-kazaro-green">
          Servicios eventuales · Espacios Verdes
        </p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-5xl">
          Indicadores de gestión
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
          Producción y productividad de los eventuales de Espacios Verdes, sobre los datos que ya se
          cargan al cerrar cada trabajo. Todavía no hay indicadores de costo: falta la tarifa por
          categoría y el monto facturado.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/15 bg-white/15 sm:grid-cols-4">
          {[
            { valor: alcance.total, etiqueta: "Eventuales de EV" },
            { valor: alcance.finalizados, etiqueta: "Cerrados" },
            { valor: alcance.enCurso, etiqueta: "En curso" },
            { valor: alcance.conHoras, etiqueta: "Con horas importadas" },
          ].map((s) => (
            <div key={s.etiqueta} className="bg-kazaro-navy/60 px-4 py-4">
              <p className="font-display text-3xl font-extrabold tabular-nums">{s.valor}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                {s.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </header>

      <Carrusel slides={slides} />

      <p className="mx-auto mt-8 max-w-[1600px] text-center text-xs text-slate-400">
        Calculado sobre {alcance.finalizados} eventual(es) finalizado(s) de {alcance.total} de Espacios
        Verdes.
      </p>
    </div>
  );
}
