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
- Registrar devoluciones
- Agregar observaciones

### 🏭 Depósito
- Visualizar pedidos pendientes
- Asignar máquinas disponibles
- Confirmar devoluciones
- Registrar faltantes o inconsistencias

### 🛠️ Administrador
- Gestionar usuarios
- Gestionar servicios
- Visualizar todos los pedidos
- Exportar información a Excel

---

## 🔄 Flujo operativo

1. El Supervisor crea un pedido indicando:
   - Servicio
   - Máquinas solicitadas
   - Observaciones

2. El Depósito revisa el pedido:
   - Asigna máquinas disponibles
   - Actualiza el estado del pedido

3. Finalizado el uso:
   - El Supervisor registra la devolución
   - El Depósito confirma la devolución
   - El pedido se cierra

---

## 🧰 Tecnologías utilizadas

### Frontend
- React
- Vite
- CSS
- React Router

### Backend
- Node.js
- Express
- Prisma ORM
- SQLite

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
│  │  ├─ components
│  │  ├─ context
│  │  └─ services
│  └─ dist
│
├─ backend
│  ├─ prisma
│  └─ src
│     ├─ controllers
│     ├─ routes
│     └─ utils
│
├─ .github
│  └─ workflows
│     └─ deploy.yml
│
└─ README.md




---

## ▶️ Ejecución en desarrollo

### Backend

cd backend
npm install
npm run dev

### Frontend

cd frontend
npm install
npm run dev


## 👤 Autor

Joaquín Rojas
Analista Operativo

[def]: image.png