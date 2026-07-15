# Prompt de transferencia estética Kazaró

Usá este documento como instrucción base para cualquier agente que tenga que construir otro frontend con la misma identidad visual del proyecto Kazaró. La meta no es aproximarse: debe replicar la misma sensación de marca, la misma jerarquía visual y el mismo criterio de uso de color, tipografía, fondos, tarjetas y navegación.

## Objetivo

Construí la interfaz del nuevo proyecto con la misma identidad visual del frontend Kazaró existente. No cambies el lenguaje visual, no lo modernices hacia otro estilo genérico y no sustituyas la marca por defaults de framework. Si necesitás crear componentes nuevos, deben parecer diseñados por el mismo equipo que hizo este frontend.

## Fuentes de verdad dentro del proyecto actual

Tomá como referencia principal estos archivos:

- `frontend/index.html`
- `frontend/tailwind.config.js`
- `frontend/src/index.css`
- `frontend/src/components/FondoKazaro.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/layouts/AdminLayout.jsx`
- `frontend/src/pages/AdminHome.jsx`
- `frontend/src/pages/SupervisorDashboard.jsx`

Nota: `frontend/src/App.css` no define la identidad visual real; es residuo del scaffold de Vite y no debe usarse como referencia estética.

## Tipografía obligatoria

- Fuente base de toda la app: `Barlow`.
- Fuente de display para títulos destacados: `Raleway`.
- Nunca reemplazar por `Inter`, `Roboto`, `Arial` como primera opción visual.
- Pesos usados en la interfaz:
  - `400` a `500` para texto de soporte.
  - `600` a `700` para labels, navegación y botones.
  - `800` a `900` para títulos hero y encabezados principales.
- Sensación tipográfica buscada: corporativa, firme, limpia, técnica, con títulos de alto peso pero sin agresividad visual.

## Paleta de marca obligatoria

Colores definidos en el proyecto:

- `kazaro-navy`: `#07173b`
- `kazaro-deep`: `#002a65`
- `kazaro-blue`: `#1172c1`
- `kazaro-sky`: `#4aa4e0`
- `kazaro-cyan`: `#2bafc6`
- `kazaro-aqua`: `#28e1e3`
- `kazaro-green`: `#65bc7b`
- `kazaro-ice`: `#e2f4ff`
- `kazaro-mist`: `#f3f8fc`

Colores auxiliares observados en vistas clave:

- Fondo general claro del body: `#eef5fa`.
- Texto principal oscuro frecuente: `#16264b`.
- Texto secundario frecuente: `#63728a` y `#72819a`.
- Bordes suaves: `#c9d6e6`, `#d9e5ef`, `slate-200`.

## Reglas de color

- La app trabaja sobre fondos claros fríos y superficies blancas, con contraste fuerte en azul marino para bloques principales.
- El azul marino y el azul medio son la base de marca.
- El cyan, aqua y verde se usan como acentos luminosos, nunca como color dominante absoluto de toda la pantalla.
- El login y algunos heroes usan fondo oscuro con luces cian/azules/verde. El resto de la app usa fondo claro con paneles blancos.
- Evitar violetas, magentas y combinaciones oscuras ajenas a la marca.
- Evitar negros puros salvo sombras profundas o overlays.

## Fondos y atmósfera visual

La marca no usa fondos planos sin intención. Hay dos escenarios principales:

### 1. Fondo claro de aplicación

- Base general: degradé muy suave de celestes/grises fríos.
- Se apoya en blobs difusos grandes y semitransparentes.
- Usa rayos diagonales sutiles animados que cruzan el fondo.
- El fondo no compite con el contenido; acompaña con profundidad ligera.

Recrear con esta lógica:

- degradé de `#f4f9fd` a `#edf5fb` y `#e4f0f6`
- blobs grandes con `#4aa4e0`, `#2bafc6`, `#65bc7b` en baja opacidad
- haces finos diagonales con brillo suave

### 2. Fondo oscuro de login / hero principal

- Base oscura en degradé entre `#07173b`, `#093055` y `#0a5a68`.
- Encima aparecen blobs amplios azul/cyan/verde con blur fuerte.
- Hay haces de luz diagonales y pequeños destellos aqua.
- La sensación buscada es tecnológica, interna/corporativa, pulida y de alto contraste.

## Motion y animación

- Las animaciones existen, pero son sutiles y lentas.
- Hay deriva suave de blobs (`20s` a `26s`).
- Hay barridos lineales de haces de luz.
- Hay pulsos pequeños de partículas brillantes.
- Los dropdowns aparecen con un `pop` corto y limpio.
- Siempre respetar `prefers-reduced-motion` desactivando animaciones.
- Nunca usar microinteracciones recargadas o rebotes excesivos.

## Layout y composición

- La app usa mucho aire visual, padding generoso y superficies bien recortadas.
- Radios predominantes:
  - `rounded-lg` para controles comunes.
  - `rounded-xl` para inputs, botones y tarjetas pequeñas.
  - `rounded-2xl` para paneles y cards importantes.
  - `rounded-3xl` para bloques hero.
- Anchuras típicas:
  - contenedores centrados con `max-w-3xl`, `max-w-7xl` o `max-w-[1600px]`
  - tarjetas principales con grids simples y legibles
- Sombras:
  - `shadow-sm` o `shadow` en cards comunes
  - `shadow-xl` o `shadow-2xl` en heroes, modales o dropdowns clave
- Bordes:
  - bordes suaves, casi siempre gris claro o azul muy claro
  - a veces `ring-1 ring-slate-200/80` para definición elegante

## Patrones estructurales recurrentes

### Heroes

- Fondo azul marino sólido o degradado.
- Formas decorativas circulares y elipses rotadas.
- Título grande en `Raleway` con peso alto.
- Texto descriptivo claro en blanco azulado.
- Logo en blanco invertido cuando aparece sobre fondo oscuro.

### Tarjetas de navegación

- Fondo blanco.
- Ícono dentro de bloque cuadrado redondeado con color de acento suave.
- Título en `Raleway` o con presencia equivalente.
- Texto secundario gris azulado.
- Hover con leve elevación y sombra más marcada.
- En algunos casos aparece una barra superior en degradé al hover.

### Header de backoffice

- Barra sticky oscura con degradé horizontal.
- Logo blanco/invertido a la izquierda.
- Navegación dentro de cápsula translúcida con borde tenue.
- Ítems activos con degradé `blue -> cyan`, texto blanco y sombra luminosa discreta.
- Línea inferior muy fina con degradé `blue -> cyan -> green`.

### Formularios

- Superficies blancas.
- Inputs altos, limpios, redondeados.
- Bordes suaves gris-azulados.
- Focus con borde azul/cyan y halo ligero.
- Labels oscuras y claras, normalmente semibold o bold.
- Mensajes de error en rojo claro, con fondo suave y borde discreto.

### Selects

- El proyecto tiene una personalización global para `select`.
- Flecha custom azul oscuro embebida como SVG.
- `rounded-xl` o radio equivalente.
- Hover con borde `kazaro-sky`.
- Focus con borde `#1e88bd` y `box-shadow` azul suave.
- Disabled con fondo gris claro y opacidad reducida.

### Modales y dropdowns

- Fondo blanco.
- Bordes suaves.
- Sombra alta pero difusa.
- Dropdowns importantes con barra superior en degradé Kazaró.
- Nada de esquinas duras ni paneles oscuros por defecto.

## Iconografía

- Íconos lineales tipo stroke, simples y corporativos.
- Grosor usual alrededor de `2`.
- Sin rellenos complejos.
- Visualmente consistentes con SVGs inline del proyecto.

## Densidad visual y tono de UI

- El sistema no es minimalista extremo ni enterprise gris genérico.
- Tiene presencia de marca, pero con sobriedad.
- Se prioriza claridad operativa y lectura rápida.
- La estética transmite orden, control, limpieza y una identidad tecnológica-industrial suave.

## Qué NO hacer

- No usar `Inter` como fuente principal.
- No meter paletas violetas, fucsias o gradientes ajenos a la marca.
- No hacer dark mode global salvo que se replique específicamente el patrón del login/hero.
- No usar glassmorphism pesado o transparencias exageradas.
- No hacer cards planas sin sombra ni relieve suave.
- No reemplazar los fondos atmosféricos por fondos lisos sin capas.
- No usar botones primarios genéricos de framework sin adaptación visual.
- No diseñar con look SaaS genérico; debe sentirse Kazaró.

## Tokens recomendados para replicar en otro proyecto

Si el nuevo proyecto usa Tailwind, crear como mínimo:

```js
colors: {
  kazaro: {
    navy: "#07173b",
    deep: "#002a65",
    blue: "#1172c1",
    sky: "#4aa4e0",
    cyan: "#2bafc6",
    aqua: "#28e1e3",
    green: "#65bc7b",
    ice: "#e2f4ff",
    mist: "#f3f8fc",
  },
},
fontFamily: {
  sans: ["Barlow", "ui-sans-serif", "system-ui", "Arial", "sans-serif"],
  display: ["Raleway", "Barlow", "Arial", "sans-serif"],
}
```

## Snippets visuales que representan bien la marca

Hero oscuro:

```jsx
<section className="relative overflow-hidden rounded-3xl bg-kazaro-navy px-8 py-12 text-white shadow-xl shadow-kazaro-navy/20">
  <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-kazaro-blue/25" />
  <div className="pointer-events-none absolute -bottom-40 right-24 h-80 w-80 rounded-full bg-kazaro-cyan/20" />
  <div className="pointer-events-none absolute -bottom-48 -right-20 h-96 w-72 rotate-[28deg] rounded-[999px] bg-kazaro-green/25 blur-[1px]" />
  <div className="relative z-10 max-w-2xl">
    <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Título Kazaró</h1>
    <p className="mt-3 text-base leading-7 text-[#d8e4f0]">Texto descriptivo.</p>
  </div>
</section>
```

Card de acceso:

```jsx
<a className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-1 hover:shadow-xl hover:ring-kazaro-sky/60">
  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-kazaro-blue to-kazaro-cyan opacity-0 transition group-hover:opacity-100" />
  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-kazaro-ice text-kazaro-blue">
    {/* ícono */}
  </span>
  <h2 className="font-display text-lg font-bold text-slate-900">Sección</h2>
  <p className="mt-2 text-sm leading-6 text-slate-500">Descripción breve.</p>
</a>
```

## Prompt listo para copiar y pasar a otro agente

```text
Replicá exactamente la identidad visual del frontend Kazaró. Usá Barlow como fuente base y Raleway para títulos destacados. Mantené la paleta de marca con estos hex: #07173b, #002a65, #1172c1, #4aa4e0, #2bafc6, #28e1e3, #65bc7b, #e2f4ff y #f3f8fc. La app debe apoyarse en fondos claros fríos con superficies blancas, bordes suaves y sombras limpias, y en bloques hero oscuros azul marino con acentos cyan/verde. Reproducí fondos atmosféricos con blobs difusos, haces diagonales sutiles y motion suave respetando prefers-reduced-motion. Usá headers sticky oscuros con degradé horizontal, navegación en cápsulas translúcidas, estados activos en degradé azul a cyan y una línea inferior fina en degradé azul-cyan-verde. Las tarjetas deben ser blancas, redondeadas, con hover de leve elevación, íconos lineales y acentos cromáticos suaves. Los formularios deben usar inputs altos, redondeados, con borde gris azulado y focus azul/cyan con halo ligero. No uses Inter, ni paletas violetas, ni estilos SaaS genéricos, ni fondos planos sin capas visuales. Cualquier componente nuevo debe parecer diseñado por el mismo equipo que hizo Kazaró.
```

## Criterio final de aceptación

Si ocultaras el logo y mostraras la pantalla a alguien que conoce el sistema actual, esa persona debería identificar inmediatamente que pertenece a la misma familia visual Kazaró.