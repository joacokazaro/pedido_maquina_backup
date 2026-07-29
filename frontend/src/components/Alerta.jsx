/**
 * Mensaje de feedback (error, éxito, aviso) estandarizado para toda la app.
 *
 * Además de unificar los colores, cumple dos funciones que faltaban:
 *
 *  1. Distingue visualmente el error del éxito. Varias pantallas usaban una
 *     única caja azul para los dos casos, así que "Pedido creado" y "Error
 *     creando el pedido" se veían idénticos.
 *  2. Anuncia el mensaje a los lectores de pantalla (`role="alert"` para los
 *     errores, `role="status"` para el resto), que hasta ahora no se enteraban
 *     de ningún error de formulario.
 *
 * Uso:
 *   <Alerta tono="error">No se pudo guardar</Alerta>
 *   <Alerta tono="exito">Pedido creado: P-0142</Alerta>
 */

const TONOS = {
  error: {
    clases: "border-red-200 bg-red-50 text-red-700",
    icono: "⚠",
  },
  exito: {
    clases: "border-green-200 bg-green-50 text-green-700",
    icono: "✓",
  },
  aviso: {
    clases: "border-amber-200 bg-amber-50 text-amber-800",
    icono: "!",
  },
  info: {
    clases: "border-blue-200 bg-blue-50 text-blue-700",
    icono: "i",
  },
};

export default function Alerta({
  tono = "info",
  children,
  className = "",
  mostrarIcono = true,
}) {
  if (!children) return null;

  const config = TONOS[tono] || TONOS.info;

  return (
    <div
      // Los errores interrumpen al lector de pantalla; el resto se anuncia
      // cuando termina de leer lo que estaba diciendo.
      role={tono === "error" ? "alert" : "status"}
      aria-live={tono === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${config.clases} ${className}`}
    >
      {mostrarIcono && (
        <span aria-hidden="true" className="mt-px flex-none font-bold">
          {config.icono}
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
