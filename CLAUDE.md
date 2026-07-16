# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

### Backend (`backend/`)
```
npm run dev                    # nodemon, puerto 3000
npm start                      # producción
npm run prisma:generate        # regenerar cliente Prisma tras cambiar schema.prisma
npm run prisma:migrate:deploy  # aplicar migraciones
npm run prisma:seed            # seed (prisma/seed.js)
```

### Frontend (`frontend/`)
```
npm run dev      # Vite en 5173; proxya /api → http://localhost:3000 (vite.config.js)
npm run build    # build de producción
npm run lint     # ESLint
```

No hay suite de tests en el proyecto.

En producción el backend sirve el build del frontend desde `backend/public/` (SPA fallback en `server.js`); el deploy corre por GitHub Actions (`.github/workflows/deploy.yml`) hacia EC2 con PM2. El frontend siempre habla con la API por mismo origen (`VITE_API_URL=/api`).

## Arquitectura

Monorepo con dos apps independientes (cada una con su propio `package.json`):

- **backend/**: Express 4 + Prisma 4 sobre SQLite + Socket.IO. Flujo `routes/ → controllers/ → services/`; el cliente Prisma se importa desde `src/db/prisma.js`. Todo cuelga de `/api`; las rutas admin se montan como varios routers sobre el mismo prefijo `/api/admin` (más `/api/admin-users`) en `server.js`.
- **frontend/**: React 19 + Vite 7 + Tailwind 3 + React Router 7. Sin librería de estado: Context API (`context/AuthContext.jsx`).

### Identidad y autorización (crítico para entender el código)

No hay tokens verificados: el frontend manda el header `x-auth-username` en cada request (`frontend/src/utils/authHeaders.js`) y el backend resuelve el actor con `requireActor(req, res, allowedRoles)` de `src/services/requestActor.service.js`, que busca ese username en la base y valida rol. **Cada controller debe llamar `requireActor` explícitamente** — no hay middleware a nivel router, y la mayoría de los controllers admin todavía no lo llama (deuda conocida). `taller.controller.js` es el patrón de referencia: roles de lectura y de edición diferenciados por endpoint.

Un usuario puede tener varios roles: `Usuario.rol` (legacy, string) convive con la relación `roles`; la lógica de resolución está en `src/services/roles.service.js` (`userHasAnyRole`, `buildUserRoleResponse`). Roles válidos: `admin`, `supervisor`, `deposito`, `coordinador`, `consultor`, `taller`.

En el frontend, `AuthContext` persiste usuario/roles en `localStorage` y `components/ProtectedRoute.jsx` corta la navegación por rol.

### Dominio

- **Servicios** son la entidad central: condicionan qué pedidos puede crear un supervisor y qué máquinas puede operar (asignación en "Supervisores x Servicios").
- **Pedidos** siguen el flujo `PENDIENTE_PREPARACION → PREPARADO → ENTREGADO → PENDIENTE_CONFIRMACION → CERRADO`, con variantes `PENDIENTE_CONFIRMACION_FALTANTES`, `PENDIENTE_CANCELACION` y `CANCELADO`. Destino puede ser depósito o otro supervisor (préstamos).
- **Máquinas** tienen estados `disponible / asignada / no_devuelta / fuera_servicio / taller / baja`, más estado de amortización (`AMORTIZADA / NO_AMORTIZADA / SIN_DATOS`) calculado por tipo de máquina y plazo.
- **Taller** registra ingresos/egresos individuales y masivos con auditoría en `TallerMovimiento`; estados legacy `reparacion` se normalizan a `taller`.
- **Eventuales** (`activo / finalizado / cancelado`) registran componentes, vehículos, trabajos y servicios extras; baja lógica, PDF solo al finalizar.

Los estados y roles son `String` en `schema.prisma` — Prisma no soporta enums sobre SQLite. Los conjuntos válidos se definen en los services (p. ej. `ESTADOS_EVENTUAL_VALIDOS` en `eventuales.service.js`); al agregar estados, validar ahí y no confiar en la base. `eventuales.service.js` también tiene el patrón preferido de errores de negocio: `buildError(message, status)` con status HTTP adjunto, que el controller devuelve tal cual.

### Tiempo real

Socket.IO se expone vía `app.set("io", ...)`; los controllers emiten con `req.app.get("io")`. Rooms: `DEPOSITO` y `USER:<username>` (el frontend se une desde `AuthContext` al conectar). Las notificaciones persisten en la tabla de notificaciones además de emitirse.

### Excel

Importación con multer en `memoryStorage` (validación de MIME, límite de filas y tamaño); exportación conviven `exceljs` y `xlsx` (se busca consolidar en `exceljs`).

## Convenciones

- Todo en español: UI, comentarios, mensajes de commit (`feat:` / `fix:` en español).
- La guía visual del frontend está en `KAZARO_FRONTEND_STYLE_TRANSFER.md` (paleta `kazaro-*`, tipografías Barlow/Raleway); las pantallas nuevas deberían usarla en lugar de los colores genéricos de Tailwind.
- `README.md` documenta roles, módulos y endpoints; `Instructivo.md` es el manual funcional de usuario final — actualizarlo si cambia un flujo operativo.
- Operaciones multi-paso sobre inventario deben ir en `prisma.$transaction` (los movimientos masivos son transaccionales por requisito).
