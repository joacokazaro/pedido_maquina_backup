# 📦 Pedido Máquina

Aplicación web interna para la gestión operativa de máquinas y vehículos: pedidos, asignaciones, devoluciones, seguros, amortizaciones, eventuales y movimientos de taller. Usada por encargados y supervisores de limpieza, personal de depósito, coordinadores, consultores, personal de taller y administradores.

---

## 🎯 Objetivo del proyecto

Centralizar el proceso operativo de la flota evitando:

- Pedidos informales (WhatsApp, papel, llamadas)
- Falta de control de disponibilidad y estado
- Errores en asignaciones y devoluciones
- Pérdida de información histórica
- Falta de trazabilidad sobre movimientos de taller

---

## 🧑‍💼 Roles del sistema

Roles válidos (`backend/src/services/roles.service.js` → `ROLES_VALIDOS`):
`admin`, `coordinador`, `consultor`, `taller`, `deposito`, `encargado_ev`, `supervisor_limpieza`.

Un usuario puede tener **varios roles**: convive el campo legacy `Usuario.rol` (string) con la relación `roles` (`UsuarioRol`). La resolución está centralizada en `roles.service.js`.

Hay dos **agrupaciones de roles** que el código usa en lugar de nombrar roles sueltos (definidas en `backend/src/services/roles.service.js` y espejadas en `frontend/src/constants/roles.js`):

| Grupo | Roles | Qué habilita |
|---|---|---|
| `ROLES_SUPERVISION` | `encargado_ev`, `supervisor_limpieza` | Los dos roles de supervisión propiamente dichos |
| `ROLES_PEDIDO_TITULAR` | `ROLES_SUPERVISION` + `coordinador` | Ser **titular** de un pedido (recibir las máquinas a su nombre), ser **supervisor asignado de un eventual** y crear pedidos para los eventuales propios |

Los roles no se combinan libremente: `isAllowedRoleCombination` acepta un único rol, o el par `deposito` + `taller`. Nadie puede ser `encargado_ev` y `supervisor_limpieza` a la vez.

### 👷 Encargado EV (`encargado_ev`)
Rename directo del ex-rol `supervisor`; mantiene todas sus funcionalidades.

- Crear pedidos de máquinas por servicio (a depósito o préstamo a otro supervisor)
- Crear pedidos **para los eventuales asignados a él**
- Gestionar préstamos entre supervisores
- Registrar devoluciones y agregar observaciones
- Solicitar la cancelación de un pedido
- Ver sus eventuales y registrar observaciones sobre ellos (no puede finalizarlos: eso pasó a Coordinador)

### 🧹 Supervisor Limpieza (`supervisor_limpieza`)
Hereda **todo** lo del encargado EV y suma una única diferencia: es el único rol de supervisión que puede **cargar las máquinas y vehículos utilizados** de un eventual asignado a él (`updateEventualComponentesBySupervisor`). Para el encargado EV esos bloques son de solo lectura.

### 🏭 Depósito
- Visualizar y preparar pedidos pendientes
- Asignar máquinas disponibles a pedidos
- Confirmar devoluciones y registrar faltantes
- Consultar máquinas por servicio y por supervisor en modo lectura
- Acceso de lectura al inventario y al módulo de taller

### 📋 Coordinador
- Acceso de solo lectura a inventario, taller, eventuales, pedidos históricos y amortizaciones
- Gestión de eventuales: completar datos, finalizar, importar horas de **Browix** e **insumos**, y cargar **insumos extra** a mano
- Puede crear pedidos de máquinas **a su propio nombre**, como un supervisor más (requiere tener servicios asignados en "Supervisores x Servicios"); accede al ciclo operativo de esos pedidos (Mis Pedidos, devoluciones)
- Puede ser **supervisor asignado de un eventual** y crear pedidos para los eventuales que tenga asignados, igual que los roles de supervisión
- No es `supervisor_limpieza`: no carga máquinas ni vehículos utilizados desde la pantalla del supervisor (sí desde el backoffice, en `/admin/eventuales/:id/completar`)

### 🔍 Consultor
- Acceso de solo lectura a inventario, servicios, taller, eventuales y amortizaciones

### 🔧 Taller
- Acceso al módulo de máquinas, vehículos y taller
- Registrar ingresos y egresos individuales y masivos con auditoría
- Consultar todo lo que está actualmente en taller

### 🛠️ Administrador
- Gestión completa de usuarios, servicios, máquinas, tipos de máquina, plazos de amortización, vehículos, seguros y pedidos
- Movimientos masivos de taller con historial completo
- Alta y administración de eventuales
- Importación y exportación a Excel

---

## 🔐 Identidad y autorización

No hay tokens verificados. El frontend envía el header `x-auth-username` en cada request (`frontend/src/utils/authHeaders.js`) y el backend resuelve el actor con `requireActor(req, res, allowedRoles)` de `src/services/requestActor.service.js`.

**Cada controller debe llamar `requireActor` explícitamente**: no hay middleware a nivel router. `taller.controller.js` es el patrón de referencia (roles de lectura y de edición diferenciados por endpoint).

En el frontend, `AuthContext` persiste usuario y roles en `localStorage`, y `components/ProtectedRoute.jsx` corta la navegación por rol.

---

## 🔄 Flujo operativo principal

1. **Pedido**: el supervisor (o el coordinador a su nombre) crea un pedido por servicio, a depósito o como préstamo a otro supervisor.
2. **Asignación**: el Depósito asigna máquinas disponibles y actualiza estado.
3. **Devolución**: el supervisor registra la devolución; el Depósito la confirma y registra faltantes si los hay.
4. **Taller**: el personal de Taller (o Admin) registra ingresos y egresos de máquinas/vehículos con auditoría completa.

### Estados de pedido

`backend/src/constants/estadosPedidos.js`:

```
PENDIENTE_PREPARACION → PREPARADO → ENTREGADO → PENDIENTE_CONFIRMACION → CERRADO
```

Variantes: `ENTREGA_CONFIRMADA`, `PENDIENTE_CONFIRMACION_FALTANTES`, `PENDIENTE_CANCELACION`, `CANCELADO`.

### Dirección de los préstamos (trampa habitual)

`Pedido.destino` es **a quién se le hace** el pedido (quien entrega las máquinas); el solicitante (`Pedido.supervisorId`) es quien las **recibe**.

En `GET /api/supervisores/:id/maquinas`, las `maquinasTemporales` con `pedido.tipo: "PRESTAMO"` aparecen cuando el supervisor consultado es el **prestamista**. Las máquinas que un supervisor tiene temporalmente en su poder son las de `pedido.tipo: "PEDIDO"` con `estado: "ENTREGADO"`; el campo `pedido.destino` distingue si vienen del depósito o de otro supervisor.

---

## 🧩 Módulos principales

### Máquinas
- Alta, edición, baja y cambio de estado
- Estados: `disponible`, `asignada`, `no_devuelta`, `fuera_servicio`, `taller`, `baja`
- Tipos de máquina configurables, con **imágenes de referencia** almacenadas en S3
- Historial de pedidos y de servicios por máquina
- Importación/exportación Excel (preview + confirm)
- Movimientos individuales y masivos de taller

### Amortizaciones
- Estado de amortización por máquina: `AMORTIZADA`, `NO_AMORTIZADA`, `SIN_DATOS`
- Plazos configurables por tipo de máquina (`/admin/plazos-amortizacion`)
- Panel de amortizaciones y recálculo masivo o por máquina

### Vehículos
- Alta, edición, baja, estados y seguros
- Estados: los de máquina más `activo`
- Asignaciones de conductor (individuales y masivas) con historial
- Faltantes por pedido
- Importación Excel y movimientos de taller

### Taller
Módulo dedicado para el rol Taller (visible en lectura para Admin, Coordinador, Consultor y Depósito).

- **Registrar Ingreso / Egreso**: selección múltiple de máquinas o vehículos, observación opcional, confirmación con modal, auditoría persistida en `TallerMovimiento`
- **Ver Taller**: listado de lo que está actualmente en taller con fecha de ingreso
- Estados `reparacion` legacy normalizados automáticamente a `taller`

### Pedidos
- Pedidos a depósito y préstamos entre supervisores
- Historial de acciones y estados
- Asignación, confirmación de devolución y registro de faltantes
- Flujo de solicitud y aprobación de cancelación
- Exportación a Excel

### Eventuales
- Estados `activo` / `finalizado` / `cancelado`, con baja lógica
- Registro de componentes, vehículos, trabajos realizados y servicios extras subcontratados
- Historial de acciones (`HistorialEventual`) y PDF al finalizar
- **Importación de horas desde Browix**: suma `minutos_teoricos_de_jornada` de los fichajes cuya `ubicacion` matchea exacto el nombre del eventual, entre `fechaInicio` y `fechaFin` (ambas obligatorias). El resultado pisa `Eventual.horasBrowix` en cada reimportación
- **Importación de insumos** desde `insumos.kazaro.com.ar`, matcheando por nombre de servicio, sin filtro de fecha
- **Insumos extra** (`Eventual.insumosExtras`): carga manual de consumos que no salen de la plataforma de insumos (nafta preparada/pura, bolsas, tanza, aceite de cadena, gasoil premium/común, herbicida y "Otro" con descripción libre) en litros, unidades, metros o centímetros cúbicos. Sin precio; se guardan junto al resto del eventual desde `/admin/eventuales/:id/completar` (admin y coordinador) y se pueden cargar en cualquier estado
- Carga manual de horas de supervisor
- **Pedidos complementarios**: el supervisor asignado al eventual (cualquier rol de `ROLES_PEDIDO_TITULAR`) puede dispararlos desde `/supervisor/pedido/nuevo` o desde el detalle del eventual; admin y coordinador pueden dispararlos como backoffice a nombre del supervisor asignado. El pedido usa (o crea) un `Servicio` homónimo al eventual y se lo autoasigna al supervisor
- **Desvincular un pedido complementario** (`DELETE /api/admin/eventuales/:id/pedidos/:pedidoId`, desde `/admin/eventuales/:id/completar`): saca el pedido del eventual sin borrarlo —sigue su circuito normal—, de modo que sus máquinas dejan de sumarse a las utilizadas y deja de fijar al supervisor titular. Es la forma de deshacer un disparo equivocado sin borrar el pedido, que rompería `getNextPedidoCode()`. Los pedidos `CANCELADO` tampoco fijan al supervisor (`contarPedidosQueFijanSupervisor`)
- **Carga de componentes desde la pantalla del supervisor** (`PUT /api/eventuales/:id/componentes`): exclusiva del `supervisor_limpieza` sobre eventuales propios; el resto lo ve en modo lectura

### Servicios
- Panel de gestión y catálogo read-only para depósito
- Asignación de supervisores por servicio ("Supervisores x Servicios")
- Importación/exportación Excel
- Campo `idBrowix` para vincular con el sistema de marcación externo

### Seguros
- Alta y gestión de seguros de vehículos

### Usuarios
- Gestión de altas, bajas, roles (multi-rol) y activación

### Notificaciones
- Persistidas en base y emitidas por Socket.IO
- Rooms: `DEPOSITO` y `USER:<username>` (el frontend se une desde `AuthContext`)

---

## 🧰 Tecnologías

### Frontend
- React 19 + Vite 7
- Tailwind CSS 3
- React Router v7
- Context API (sin librería de estado)
- Socket.IO Client
- jsPDF + jspdf-autotable (PDFs de eventuales)

### Backend
- Node.js + Express 4
- Prisma ORM 4 (SQLite)
- Socket.IO
- Helmet + express-rate-limit + CORS
- Multer (imports en `memoryStorage`)
- ExcelJS (import/export)
- AWS SDK v3 (S3, para imágenes de referencia de tipos de máquina)

### Infraestructura
- AWS EC2 + nginx
- PM2
- GitHub Actions (CI/CD, `.github/workflows/deploy.yml`)

En producción el backend sirve el build del frontend desde `backend/public/` (SPA fallback en `src/server.js`). El frontend siempre habla con la API por mismo origen (`VITE_API_URL=/api`).

---

## 📁 Estructura del proyecto

```
pedido_maquina_backup/
├─ frontend/
│  └─ src/
│     ├─ pages/
│     │  ├─ taller/              ← módulo de taller separado por pantallas
│     │  ├─ AdminMaquinas.jsx
│     │  ├─ AdminVehiculos.jsx
│     │  ├─ AdminEventual*.jsx
│     │  ├─ AdminAmortizacionesPanel.jsx
│     │  ├─ AdminHome.jsx / CoordinadorHome.jsx / ConsultorHome.jsx / TallerHome.jsx
│     │  └─ ...
│     ├─ components/
│     │  └─ ProtectedRoute.jsx   ← corte de navegación por rol
│     ├─ constants/
│     │  └─ roles.js             ← ROLES_SUPERVISION / ROLES_PEDIDO_TITULAR
│     ├─ context/
│     │  └─ AuthContext.jsx
│     ├─ layouts/
│     ├─ services/
│     └─ utils/
│        └─ authHeaders.js       ← header x-auth-username para actor backend
│
└─ backend/
   ├─ prisma/
   │  ├─ schema.prisma
   │  ├─ seed.js
   │  └─ migrations/
   └─ src/
      ├─ constants/
      │  └─ estadosPedidos.js
      ├─ controllers/            ← routes/ → controllers/ → services/
      ├─ db/
      │  └─ prisma.js            ← cliente Prisma compartido
      ├─ routes/
      └─ services/
         ├─ requestActor.service.js
         ├─ roles.service.js
         ├─ inventarioEstados.service.js
         ├─ taller.service.js
         ├─ eventuales.service.js
         ├─ browix.service.js
         ├─ insumos.service.js
         ├─ notificaciones.service.js
         ├─ s3Referencias.service.js
         └─ httpError.service.js
```

---

## 🔌 Endpoints principales

Todo cuelga de `/api`. Los routers admin se montan como varios routers sobre el mismo prefijo `/api/admin` (más `/api/admin-users` y `/api/supervisores`).

### Auth y notificaciones
- `POST /api/auth/login`
- `GET /api/notificaciones` · `PUT /api/notificaciones/:id/leida`

### Pedidos (operativo)
- `POST /api/pedidos` · `GET /api/pedidos` · `GET /api/pedidos/:id`
- `GET /api/pedidos/supervisor/:supervisorId` · `GET /api/pedidos/prestamos/:username`
- `GET /api/pedidos/usuarios/:username/servicios`
- `PUT /api/pedidos/:id/estado` · `PUT /api/pedidos/:id/entregar`
- `POST /api/pedidos/:id/asignar` · `POST /api/pedidos/:id/devolucion`
- `POST /api/pedidos/:id/confirmar-devolucion` · `POST /api/pedidos/:id/completar-faltantes`
- `POST /api/pedidos/:id/solicitar-cancelacion`

### Pedidos (admin)
- `GET /api/admin/pedidos` · `GET /api/admin/pedidos/export` · `GET /api/admin/pedidos/:id`
- `PUT /api/admin/pedidos/:id` · `PUT /api/admin/pedidos/:id/estado`
- `POST /api/admin/pedidos/:id/aprobar-cancelacion` · `DELETE /api/admin/pedidos/:id`

### Máquinas
- `GET /api/maquinas` · `GET /api/maquinas/:id` · `GET /api/maquinas/tipo/:tipo`
- `PUT /api/maquinas/:id/estado` · `PUT /api/maquinas/:id/taller`
- `GET /api/admin/maquinas` · `POST /api/admin/maquinas` · `PUT /api/admin/maquinas/:id` · `DELETE /api/admin/maquinas/:id`
- `GET /api/admin/maquinas/stock-resumen` · `GET /api/admin/maquinas/:id/pedidos-historicos`
- `GET /api/admin/maquinas/export` · `GET /api/admin/maquinas/import/template`
- `POST /api/admin/maquinas/import/preview` · `POST /api/admin/maquinas/import/confirm`
- `POST /api/admin/maquinas/movimientos-masivos`

### Tipos de máquina y amortización
- `GET|POST /api/admin/maquinas/tipos` · `PUT|DELETE /api/admin/maquinas/tipos/:tipoId`
- `GET /api/admin/maquinas/tipos/:tipoId/referencias` · `DELETE /api/admin/maquinas/tipos/:tipoId/referencias/:referenciaId`
- `GET|POST /api/admin/maquinas/plazos-amortizacion` · `PUT|DELETE /api/admin/maquinas/plazos-amortizacion/:plazoId`
- `POST /api/admin/maquinas/amortizacion/recalcular` · `POST /api/admin/maquinas/:id/amortizacion/recalcular`

### Vehículos
- `GET /api/vehiculos` · `GET /api/vehiculos/:id` · `PUT /api/vehiculos/:id/taller`
- `GET|POST /api/admin/vehiculos` · `PUT|DELETE /api/admin/vehiculos/:id` · `GET /api/admin/vehiculos/:id/historial`
- `GET /api/admin/vehiculos/export` · `GET /api/admin/vehiculos/import/template` · `POST /api/admin/vehiculos/import`
- `POST /api/admin/vehiculos/:id/asignaciones` · `DELETE /api/admin/vehiculos/:id/asignaciones/actual`
- `POST /api/admin/vehiculos/asignaciones-masivas`

### Taller
- `GET /api/admin/taller/maquinas/historial` · `GET /api/admin/taller/vehiculos/historial`
- `POST /api/admin/taller/maquinas/movimientos` · `POST /api/admin/taller/vehiculos/movimientos`

### Servicios
- `GET /api/servicios` · `GET /api/servicios/catalogo` · `GET /api/servicios/catalogo/:id` · `GET /api/servicios/usuario/:username`
- `GET|POST /api/admin/servicios` · `GET|PUT|DELETE /api/admin/servicios/:id`
- `GET /api/admin/servicios/export` · `GET /api/admin/servicios/import/template` · `POST /api/admin/servicios/import`

### Supervisores
- `GET /api/supervisores` · `GET /api/supervisores/catalogo` · `GET /api/supervisores/usuarios-operativos`
- `GET /api/supervisores/:id/maquinas` · `GET /api/supervisores/:id/vehiculos`
- `GET|PUT /api/supervisores/:id/servicios`

> `catalogo`, `:id/maquinas` y `:id/vehiculos` resuelven sobre `ROLES_PEDIDO_TITULAR`, así que también devuelven coordinadores. `catalogo` alimenta el desplegable de supervisor del eventual, los filtros de `/admin/maquinas` y `/admin/eventuales/historial`, y la pantalla `/deposito/supervisores`.

### Eventuales
- `GET /api/eventuales/mis/:username` · `GET /api/eventuales/:id`
- `PUT /api/eventuales/:id/componentes` · `POST /api/eventuales/:id/observaciones` · `POST /api/eventuales/:id/finalizar`
- `GET|POST /api/admin/eventuales` · `GET|PUT|DELETE /api/admin/eventuales/:id`
- `GET /api/admin/eventuales/componentes/catalogo`
- `POST /api/admin/eventuales/:id/importar-horas-browix` · `POST /api/admin/eventuales/:id/importar-insumos`
- `PUT /api/admin/eventuales/:id/horas-supervisor`
- `DELETE /api/admin/eventuales/:id/pedidos/:pedidoId` (desvincula un pedido complementario; admin y coordinador)

### Seguros
- `GET|POST /api/admin/seguros` · `PUT|DELETE /api/admin/seguros/:id`

### Usuarios
- `GET|POST /api/admin-users` · `GET|PUT|DELETE /api/admin-users/:username`
- `GET /api/admin-users/export` (Excel de usuarios, solo admin; nunca incluye la contraseña)

---

## 🖥️ Rutas frontend

### Supervisión (`encargado_ev`, `supervisor_limpieza`) y Coordinador como titular
- `/supervisor` · `/supervisor/pedidos` · `/supervisor/pedido/nuevo` · `/supervisor/pedido/:id`
- `/supervisor/pedido/:id/devolucion`
- `/supervisor/maquinas` · `/supervisor/maquinas/:id` · `/supervisor/vehiculos`
- `/supervisor/prestamos` · `/supervisor/prestamo/:id` · `/supervisor/prestamo/:id/asignar` · `/supervisor/prestamo/:id/confirmar`
- `/supervisor/eventuales` · `/supervisor/eventuales/:id`

### Depósito
- `/deposito` · `/deposito/pedidos` · `/deposito/pedido/:id` · `/deposito/pedido/:id/asignar` · `/deposito/pedido/:id/confirmar`
- `/deposito/maquinas` · `/deposito/servicios` · `/deposito/servicios/:id` · `/deposito/supervisores`

### Backoffice (`/admin`)
El home resuelve por rol: `AdminHome`, `CoordinadorHome`, `ConsultorHome` o `TallerHome`.

Grupos de acceso definidos en `App.jsx`:

| Helper | Roles habilitados |
|---|---|
| `renderAdminOnlyPage` | `ADMIN` |
| `renderBackofficePage` | `ADMIN`, `COORDINADOR` |
| `renderReadOnlyModulesPage` | `ADMIN`, `COORDINADOR`, `CONSULTOR` |
| `renderInventarioTallerPage` | `ADMIN`, `COORDINADOR`, `CONSULTOR`, `TALLER`, `DEPOSITO` |

- **Máquinas**: `/admin/maquinas` · `/admin/maquinas/nueva` · `/admin/maquinas/:id` · `/admin/maquinas/:id/pedidos-historicos` · `/admin/maquinas/tipos` · `/admin/maquinas/amortizaciones` · `/admin/plazos-amortizacion`
- **Vehículos**: `/admin/vehiculos` · `/admin/vehiculos/nuevo` · `/admin/vehiculos/:id` · `/admin/vehiculos/:id/historial` · `/admin/vehiculos/asignaciones` · `/admin/vehiculos/importar`
- **Taller**: `/admin/taller` · `/admin/taller/registrar` (`/maquinas`, `/vehiculos`) · `/admin/taller/ver` (`/maquinas`, `/vehiculos`)
- **Eventuales**: `/admin/eventuales` · `/admin/eventuales/historial` · `/admin/eventuales/nuevo` · `/admin/eventuales/:id` · `/admin/eventuales/:id/completar` · `/admin/eventuales/:id/finalizar`
- **Servicios**: `/admin/servicios` · `/admin/servicios/nuevo` · `/admin/servicios/:id` · `/admin/servicios/importar` · `/admin/supervisores-servicios` · `/admin/supervisores`
- **Otros**: `/admin/pedidos` · `/admin/pedido/:id` · `/admin/usuarios` (`/nuevo`, `/:username`) · `/admin/seguros`

---

## ▶️ Ejecución en desarrollo

### Backend

```
cd backend
npm install
npm run dev                    # nodemon, puerto 3000
```

Otros comandos:

```
npm start                      # producción
npm run prisma:generate        # regenerar cliente tras cambiar schema.prisma
npm run prisma:migrate:deploy  # aplicar migraciones
npm run prisma:seed            # seed (prisma/seed.js)
```

### Frontend

```
cd frontend
npm install
npm run dev      # Vite en 5173; proxya /api → http://localhost:3000
npm run build    # build de producción
npm run lint     # ESLint
```

No hay suite de tests en el proyecto.

### Variables de entorno relevantes (`backend/.env`)

- `DATABASE_URL` — SQLite. En producción: `/var/lib/pedido-maquina/db/pedido.db`
- `ALLOWED_ORIGINS` — orígenes habilitados para CORS
- `BROWIX_BASE_URL`, `BROWIX_WORKGROUP_UUID`, `BROWIX_GRUPO_IDS`, `BROWIX_AUTH_TOKEN`
- `INSUMOS_API_BASE_URL`, `INSUMOS_API_TOKENS` (un token por empresa, separados por coma)
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_REFERENCIAS_PREFIX`

---

## 📌 Notas de implementación

- Los servicios son la entidad central del sistema: vinculan máquinas, pedidos y permisos operativos. La asignación de servicios condiciona qué pedidos puede crear un supervisor y qué máquinas puede operar.
- Los estados y roles son `String` en `schema.prisma` (Prisma no soporta enums sobre SQLite). Los conjuntos válidos se definen en los services y constants: validar ahí y no confiar en la base.
- Patrón de errores de negocio: `buildError(message, status)` con status HTTP adjunto, que el controller devuelve tal cual (ver `eventuales.service.js`).
- Las operaciones multi-paso sobre inventario van en `prisma.$transaction`; los movimientos masivos son transaccionales por requisito.
- `Pedido.id` es `TEXT` con formato `P-0001`, generado a mano en `getNextPedidoCode()` vía `MAX(SUBSTR(id,3))+1`. Borrar el pedido con el número más alto hace que el próximo insert reutilice un ID ya usado. El resto de los modelos usa `AUTOINCREMENT` nativo y no tiene ese riesgo.
- La vista "Máquinas en Servicio" para depósito es solo lectura y reutiliza endpoints públicos de catálogo, sin acceso a edición.
- La vista "Máquinas por Supervisor" para depósito es solo lectura y separa máquinas fijas por servicios asignados de máquinas temporales vinculadas a pedidos activos.
- Browix limita las consultas por uuid: `getWorkgroupschedulePlan` exige 10s entre consultas y `getUsers` 1s. Por eso las consultas se hacen secuenciales y espaciadas, con un reintento ante rate-limit antes de abortar.

---

## 📚 Documentación relacionada

- `CLAUDE.md` — guía de arquitectura para trabajar sobre el repo
- `Instructivo.md` — manual funcional para el usuario final
- `KAZARO_FRONTEND_STYLE_TRANSFER.md` — guía visual (paleta `kazaro-*`, tipografías Barlow/Raleway)

---

## 👤 Autor

Joaquín Rojas
Mejora e Innovación
