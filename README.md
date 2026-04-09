# 📦 Pedido Máquina Backup

Aplicación web interna para la gestión de pedidos, asignación y devolución de máquinas, utilizada por supervisores, personal de depósito y administradores.

El sistema centraliza y ordena el proceso operativo, permitiendo control de stock, trazabilidad y reducción de errores en la gestión diaria.

---

## 🎯 Objetivo del proyecto

Optimizar el proceso operativo de pedido y devolución de máquinas, evitando:

- Pedidos informales (WhatsApp, papel, llamadas)
- Falta de control de disponibilidad
- Errores en asignaciones
- Pérdida de información histórica

La aplicación está pensada para uso interno, con control total de usuarios y datos.

---

## 🧑‍💼 Roles del sistema

### 👷 Supervisor
- Crear pedidos de máquinas por servicio
- Visualizar el estado de sus pedidos
- Gestionar préstamos entre supervisores
- Registrar devoluciones
- Agregar observaciones

### 🏭 Depósito
- Visualizar pedidos pendientes
- Asignar máquinas disponibles
- Confirmar devoluciones
- Registrar faltantes o inconsistencias
- Consultar máquinas por servicio en modo solo lectura

### 🛠️ Administrador
- Gestionar usuarios
- Gestionar servicios
- Asignar servicios a supervisores y usuarios operativos
- Gestionar máquinas
- Visualizar todos los pedidos
- Exportar información a Excel

---

## 🔄 Flujo operativo

1. El Supervisor crea un pedido indicando:
   - Servicio
   - Máquinas solicitadas
   - Observaciones
   - Destino del pedido: depósito o préstamo a otro supervisor

2. El Depósito revisa el pedido:
   - Asigna máquinas disponibles
   - Actualiza el estado del pedido
   - Puede consultar máquinas agrupadas por servicio

3. Finalizado el uso:
   - El Supervisor registra la devolución
   - El Depósito confirma la devolución
   - El pedido se cierra

4. El Administrador puede:
   - Crear, editar y eliminar servicios
   - Ver las máquinas asociadas a cada servicio
   - Asignar qué servicios puede operar cada usuario operativo

---

## 🧩 Módulos principales

### Servicios
- Panel administrador para gestión de servicios
- Detalle de servicio con máquinas asociadas
- Validación para impedir eliminar servicios con máquinas asociadas
- Catálogo read-only para depósito: "Máquinas en Servicio"

### Supervisores x Servicios
- Asignación de servicios habilitados a supervisores y depósito
- Impacta directamente en la creación de pedidos y asignación de máquinas

### Máquinas
- Alta, edición, baja y cambio de estado
- Asociación obligatoria a un servicio
- Visualización de pedido activo cuando la máquina está asignada

### Pedidos
- Pedidos a depósito
- Préstamos entre supervisores
- Historial de acciones
- Confirmación de devolución y registro de faltantes

---

## 🧰 Tecnologías utilizadas

### Frontend
- React
- Vite
- CSS
- React Router
- Context API
- Socket.IO Client

### Backend
- Node.js
- Express
- Prisma ORM
- SQLite
- Socket.IO

### Infraestructura
- AWS EC2
- PM2
- SSH
- GitHub Actions (CI/CD)

---

## 📁 Estructura del proyecto

pedido_maquina_backup
├─ frontend
│  ├─ src
│  │  ├─ pages
│  │  │  ├─ AdminServicios.jsx
│  │  │  ├─ AdminServicioForm.jsx
│  │  │  ├─ AdminSupervisoresServicios.jsx
│  │  │  ├─ DepositoServicios.jsx
│  │  │  └─ DepositoServicioDetalle.jsx
│  │  ├─ components
│  │  ├─ context
│  │  └─ services
│  └─ dist
│
├─ backend
│  ├─ prisma
│  └─ src
│     ├─ controllers
│     │  ├─ adminServicios.controller.js
│     │  ├─ admin_supervisores.controller.js
│     │  └─ servicios.controller.js
│     ├─ routes
│     │  ├─ adminServicios.routes.js
│     │  ├─ admin_supervisores.routes.js
│     │  └─ servicios.routes.js
│     └─ utils
│
└─ README.md




---

## 🔌 Endpoints relevantes

### Servicios
- `GET /api/servicios`: listado simple de servicios
- `GET /api/servicios/catalogo`: catálogo de servicios con cantidad de máquinas
- `GET /api/servicios/catalogo/:id`: detalle read-only de un servicio con sus máquinas y pedido activo si existe
- `GET /api/servicios/usuario/:username`: servicios asignados a un usuario operativo

### Administración de servicios
- `GET /api/admin/servicios`
- `GET /api/admin/servicios/:id`
- `POST /api/admin/servicios`
- `PUT /api/admin/servicios/:id`
- `DELETE /api/admin/servicios/:id`

### Supervisores x Servicios
- `GET /api/supervisores`
- `GET /api/supervisores/:id/servicios`
- `PUT /api/supervisores/:id/servicios`

---

## 🖥️ Rutas frontend relevantes

### Depósito
- `/deposito`
- `/deposito/pedidos`
- `/deposito/maquinas`
- `/deposito/servicios`
- `/deposito/servicios/:id`

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
- La asignación de servicios condiciona qué pedidos puede crear un supervisor y qué máquinas puede operar.


## 👤 Autor

Joaquín Rojas
Mejora e Innovación
