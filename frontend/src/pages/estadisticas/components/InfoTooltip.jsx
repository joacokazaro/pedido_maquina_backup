// Ícono "i" circular con tooltip al hover, para aclarar cómo leer una
// métrica sin ensuciar el título del panel. Puro CSS (group-hover), sin
// estado de React.
export default function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex">
      <svg
        className="h-3.5 w-3.5 cursor-help text-slate-400 transition hover:text-kazaro-blue"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
      </svg>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-lg bg-kazaro-navy px-3 py-2 text-xs font-normal normal-case leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
