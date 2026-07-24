# 📦 Pedido Máquina

Aplicación web interna para la gestión operativa de máquinas y vehículos: pedidos, asignaciones, devoluciones, seguros, eventuales y movimientos de taller. Usada por supervisores, personal de depósito, coordinadores, consultores, personal de taller y administradores.

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

### 👷 Supervisor
- Crear pedidos de máquinas por servicio
- Gestionar préstamos entre supervisores
- Registrar devoluciones y agregar observaciones
- Ver sus eventuales

### 🏭 Depósito
- Visualizar y preparar pedidos pendientes
- Asignar máquinas disponibles a pedidos
- Confirmar devoluciones y registrar faltantes
- Consultar máquinas por servicio y supervisor en modo lectura

### 📋 Coordinador
- Acceso de solo lectura a inventario, taller, eventuales, pedidos históricos y kits
- Gestión de eventuales (completar datos, finalizar, importar horas Browix e insumos)
- Puede crear pedidos de máquinas **a su propio nombre**, como un supervisor más (requiere tener servicios asignados en "Supervisores x Servicios"); accede al ciclo operativo de esos pedidos (Mis Pedidos, devoluciones)
- Vista operativa de estado general del sistema

### 🔍 Consultor
- Acceso de solo lectura a inventario, servicios, taller y eventuales

### 🔧 Taller
- Acceso exclusivo al módulo de máquinas, vehículos y taller
- Registrar ingresos y egresos masivos de taller con auditoría
- Consultar todo lo que está actualmente en taller

### 🛠️ Administrador
- Gestión completa de usuarios, servicios, máquinas, vehículos, seguros, kits y pedidos
- Movimientos masivos de taller con historial completo
- Gestión de eventuales y coordinación
- Exportación a Excel

---

## 🔄 Flujo operativo principal

1. **Pedido**: el Supervisor crea un pedido por servicio (a depósito o préstamo a otro supervisor).
2. **Asignación**: el Depósito asigna máquinas disponibles y actualiza estado.
3. **Devolución**: el Supervisor registra la devolución; el Depósito la confirma y registra faltantes si los hay.
4. **Taller**: el personal de Taller (o Admin) registra ingresos y egresos de máquinas/vehículos con auditoría completa.

---

## 🧩 Módulos principales

### Máquinas
- Alta, edición, baja y cambio de estado
- Estados: `disponible`, `asignada`, `no_devuelta`, `fuera_servicio`, `taller`, `baja`
- Historial de pedidos por máquina
- Movimientos individuales y masivos de taller

### Vehículos
- Alta, edición, baja, estados y seguros
- Asignación de conductor y póliza de seguro
- Faltantes por pedido
- Movimientos de taller individuales y masivos

### Taller (módulo)
Módulo dedicado para el rol Taller (y visible en lectura para Admin, Coordinador y Consultor).

- **Registrar Ingreso / Egreso**: selección múltiple de máquinas o vehículos, observación opcional, confirmación con modal, auditoría persistida en `TallerMovimiento`.
- **Ver Taller**: listado de lo que está actualmente en taller con fecha de ingreso.
- Estados `reparacion` legacy normalizados automáticamente a `taller`.

### Pedidos
- Pedidos a depósito y préstamos entre supervisores
- Historial de acciones y estados
- Asignación y confirmación de devolución

### Eventuales
- Registro de eventuales con kits y componentes utilizados
- Historial y detalles operativos por supervisor
- Gestión administrativa con corrección y finalización por coordinador

### Kits
- Alta y edición de kits con componentes
- Asociación a eventuales

### Servicios
- Panel de gestión y catálogo read-only para depósito
- Asignación de supervisores por servicio

### Seguros
- Alta y gestión de seguros de vehículos

### Usuarios
- Gestión de altas, bajas, roles y activación
- Roles válidos: `admin`, `supervisor`, `deposito`, `coordinador`, `consultor`, `taller`

---

## 🧰 Tecnologías

### Frontend
- React 19 + Vite 7
- Tailwind CSS
- React Router v7
- Context API
- Socket.IO Client

### Backend
- Node.js + Express
- Prisma ORM 4 (SQLite)
- Socket.IO
- Multer (imports)
- xlsx (exportación Excel)

### Infraestructura
- AWS EC2
- PM2
- SSH
- GitHub Actions (CI/CD)

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
│     │  ├─ AdminHome.jsx
│     │  ├─ TallerHome.jsx
│     │  └─ ...
│     ├─ components/
│     ├─ context/
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
      ├─ controllers/
      │  ├─ taller.controller.js
      │  ├─ adminMaquinas.controller.js
      │  ├─ adminVehiculos.controller.js
      │  └─ ...
      ├─ routes/
      │  ├─ taller.routes.js
      │  └─ ...
      └─ services/
         ├─ taller.service.js
         ├─ inventarioEstados.service.js
         └─ requestActor.service.js
```

---

## 🔌 Endpoints principales

### Taller (nuevo módulo)
- `GET /api/admin/taller/maquinas/historial`
- `GET /api/admin/taller/vehiculos/historial`
- `POST /api/admin/taller/maquinas/movimientos`
- `POST /api/admin/taller/vehiculos/movimientos`
- `PUT /api/maquinas/:id/taller`
- `PUT /api/vehiculos/:id/taller`

### Máquinas
- `GET /api/admin/maquinas`
- `GET /api/admin/maquinas/:id`
- `POST /api/admin/maquinas`
- `PUT /api/admin/maquinas/:id`
- `GET /api/admin/maquinas/stock-resumen`

### Vehículos
- `GET /api/admin/vehiculos`
- `GET /api/admin/vehiculos/:id`
- `POST /api/admin/vehiculos`
- `PUT /api/admin/vehiculos/:id`

### Servicios
- `GET /api/servicios`
- `GET /api/admin/servicios`
- `POST /api/admin/servicios`
- `PUT /api/admin/servicios/:id`
- `DELETE /api/admin/servicios/:id`

---

## 🖥️ Rutas frontend

### Admin / Coordinador / Consultor / Taller
- `/admin` — home por rol
- `/admin/maquinas` y `/admin/maquinas/:id`
- `/admin/vehiculos` y `/admin/vehiculos/:id`
- `/admin/taller` — inicio módulo taller
- `/admin/taller/registrar` — selección máquinas o vehículos
- `/admin/taller/registrar/maquinas`
- `/admin/taller/registrar/vehiculos`
- `/admin/taller/ver`
- `/admin/taller/ver/maquinas`
- `/admin/taller/ver/vehiculos`
- `/admin/pedidos`, `/admin/eventuales`, `/admin/kits`, `/admin/usuarios`, `/admin/servicios`, `/admin/seguros`

### Depósito
- `/deposito`, `/deposito/pedidos`, `/deposito/maquinas`, `/deposito/supervisores`, `/deposito/servicios/:id`

### Supervisor
- `/supervisor`, `/supervisor/pedidos`, `/supervisor/maquinas`, `/supervisor/vehiculos`, `/supervisor/prestamos`, `/supervisor/eventuales`

### Administrador
- `/admin`
- `/admin/maquinas`
- `/admin/pedidos`
- `/admin/usuarios`
- `/admin/servicios`
- `/admin/servicios/nuevo`
- `/admin/servicios/:id`
- `/admin/supervisores-servicios`

## ▶️ Ejecución en desarrollo

### Backend

cd backend
npm install
npm run dev

### Frontend

cd frontend
npm install
npm run dev

---

## 📌 Notas de implementación

- Los servicios son una entidad central del sistema: vinculan máquinas, pedidos y permisos operativos.
- La vista "Máquinas en Servicio" para depósito es solo lectura y reutiliza endpoints públicos de catálogo, sin acceso a edición.
- La vista "Máquinas por Supervisor" para depósito es solo lectura y separa máquinas fijas por servicios asignados de máquinas temporales vinculadas a pedidos activos.
- La asignación de servicios condiciona qué pedidos puede crear un supervisor y qué máquinas puede operar.


## 👤 Autor

Joaquín Rojas
Mejora e Innovación
