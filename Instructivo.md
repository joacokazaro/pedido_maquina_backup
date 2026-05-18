# Instructivo de uso - Pedido Máquina Backup

## 1. Portada

**Aplicación:** Pedido Máquina Backup  
**Tipo de documento:** Instructivo funcional de usuario  
**Destinatarios:** Supervisor, Depósito y Administrador  
**Uso:** Interno  
**Última actualización:** Mayo 2026

Este documento explica cómo utilizar la aplicación Pedido Máquina Backup desde el punto de vista del usuario final. Está orientado a la operación diaria y no a tareas técnicas o de desarrollo.

## 2. Objetivo del instructivo

Brindar una guía clara para que cada usuario pueda:

1. Ingresar al sistema correctamente.
2. Identificar qué funciones tiene habilitadas según su rol.
3. Ejecutar las tareas habituales paso a paso.
4. Interpretar los estados de los pedidos.
5. Usar la aplicación con criterios consistentes y trazables.

## 3. Descripción general de la aplicación

Pedido Máquina Backup es una aplicación web interna utilizada para organizar el ciclo completo de solicitud, asignación, entrega y devolución de máquinas.

El sistema reemplaza pedidos informales y permite:

- Centralizar solicitudes.
- Controlar disponibilidad de máquinas.
- Registrar quién pidió, quién entregó y quién devolvió.
- Mantener historial de acciones.
- Detectar faltantes o diferencias al momento de la devolución.
- Consultar información operativa por servicio y por supervisor.

En términos generales, el flujo de trabajo es el siguiente:

1. Un Supervisor crea un pedido.
2. Depósito o un Supervisor receptor prepara y entrega las máquinas.
3. Quien recibió las máquinas registra la devolución cuando finaliza el uso.
4. El receptor confirma la devolución y el pedido queda cerrado, o bien se registran faltantes.
5. El Administrador gestiona usuarios, servicios, máquinas y auditoría general.

## 4. Acceso al sistema

### 4.1 Ingreso

Para ingresar:

1. Abrir la aplicación en el navegador.
2. Completar el campo **Usuario**.
3. Completar el campo **Contraseña**.
4. Presionar **Entrar**.

Si las credenciales son incorrectas, el sistema muestra el mensaje: **Usuario o contraseña incorrectos**.

### 4.2 Inicio del sistema

En algunos casos, antes de mostrar el login puede aparecer una pantalla de inicio de aplicación con el mensaje **Iniciando aplicación...** o similar. Si sucede:

1. Esperar unos segundos.
2. Si no avanza, presionar **Reintentar**.

### 4.3 Redirección por rol

Una vez autenticado, el sistema redirige automáticamente según el rol del usuario:

- Supervisor: panel del supervisor.
- Depósito: panel de depósito.
- Administrador: panel de administración.

### 4.4 Notificaciones

Cuando el usuario ya está dentro del sistema, puede visualizar notificaciones desde el ícono de campana. Allí se informan novedades relevantes, por ejemplo:

- Pedido creado.
- Pedido preparado.
- Pedido entregado.
- Devolución registrada.
- Estado actualizado.
- Solicitud de cancelación.

**Captura sugerida:** pantalla de login y campana de notificaciones.

## 5. Roles del sistema

| Rol | Objetivo principal | Funciones principales |
| --- | --- | --- |
| Supervisor | Solicitar máquinas y gestionar devoluciones | Crear pedidos, consultar estados, gestionar préstamos entre supervisores, registrar devoluciones |
| Depósito | Gestionar preparación, entrega y control de devoluciones | Ver pedidos operativos, asignar máquinas, confirmar devoluciones, revisar máquinas por servicio y por supervisor |
| Administrador | Mantener el sistema y controlar la operación global | Gestionar usuarios, servicios, máquinas, permisos operativos y pedidos |

## 6. Funcionalidades del rol Supervisor

### 6.1 Panel principal

Al ingresar como Supervisor, el usuario visualiza un panel con dos accesos principales:

- **Mis pedidos**: muestra los pedidos creados por ese supervisor.
- **Mis préstamos**: muestra los pedidos que otros supervisores le realizaron.

Desde estas dos opciones se concentra toda la operación del rol.

![Panel principal del Supervisor](capturas/panel_principal_supervisor.png)

### 6.2 Crear pedido de máquinas

Para crear un nuevo pedido:

1. Ingresar a **Mis pedidos**.
2. Presionar **Crear nuevo pedido**.
3. Elegir el destino del pedido:
	- **Depósito**.
	- **Supervisor**.
4. Seleccionar el servicio donde se utilizarán las máquinas.
5. Indicar la cantidad requerida por tipo de máquina.
6. Si hace falta un tipo no contemplado en la lista principal, agregarlo en la sección correspondiente a otros tipos.
7. Completar una observación si corresponde.
8. Si el destino es otro supervisor, seleccionar el supervisor receptor.
9. Presionar **Crear pedido**.

Consideraciones importantes:

- El Supervisor solo puede seleccionar servicios que tenga habilitados.
- El sistema exige pedir al menos una máquina.
- Si el pedido fue creado correctamente, la aplicación informa el número de pedido.

Resultado esperado:

- El pedido queda registrado con estado inicial **PENDIENTE_PREPARACION**.

![Formulario de creación de pedido](capturas/formulario_creacion_pedido.png)

### 6.3 Consultar estado de pedidos

En **Mis pedidos**, el Supervisor puede:

1. Ver el listado de pedidos creados.
2. Filtrar por estado.
3. Abrir un pedido para ver su detalle.
4. Consultar el historial de acciones.
5. Ver las máquinas asignadas y el resumen del pedido.

Estados visibles con mayor frecuencia:

- **PENDIENTE_PREPARACION**.
- **PREPARADO**.
- **ENTREGADO**.
- **PENDIENTE_CONFIRMACION**.
- **CERRADO**.

En algunos casos, si un pedido cerrado tuvo faltantes confirmados, la interfaz puede mostrar una advertencia visual indicando esa situación.

![Listado de pedidos del Supervisor](capturas/listado_pedidos.png)

![Detalle de un pedido](capturas/detalle_pedido.png)

### 6.4 Gestionar préstamos entre supervisores

La aplicación contempla préstamos entre supervisores. En este caso, un supervisor solicita máquinas a otro supervisor en lugar de pedirlas a Depósito.

#### 6.4.1 Solicitar un préstamo

Para solicitar un préstamo:

1. Crear un pedido nuevo.
2. Seleccionar como destino a **Supervisor**.
3. Elegir el supervisor receptor.
4. Completar el resto del pedido y confirmar.

#### 6.4.2 Gestionar préstamos recibidos

En **Mis préstamos**, el supervisor receptor puede:

1. Ver los pedidos que otros supervisores le realizaron.
2. Filtrar por estado.
3. Abrir el detalle del préstamo.
4. Asignar máquinas si el pedido está pendiente.
5. Marcar el pedido como preparado.
6. Marcar el pedido como entregado.
7. Confirmar la devolución cuando las máquinas regresan.

Este flujo es operativo y se comporta de forma muy similar al flujo de Depósito.

![Pantalla de Mis Préstamos](capturas/mis_prestamos.png)

![Detalle operativo de un préstamo](capturas/detalle_prestamos.png)

### 6.5 Registrar devolución

Cuando el pedido ya fue entregado, el Supervisor puede registrar la devolución.

Pasos:

1. Ingresar al detalle del pedido entregado.
2. Presionar **Registrar devolución**.
3. Marcar las máquinas efectivamente devueltas.
4. Revisar el total devuelto sobre el total asignado.
5. Si no se devuelve la totalidad, completar una justificación obligatoria.
6. Presionar **Confirmar devolución**.

Resultado esperado:

- El pedido pasa a estado **PENDIENTE_CONFIRMACION** para que el receptor confirme la devolución.

Si posteriormente el sistema detectó faltantes confirmados y luego esos faltantes aparecen, el Supervisor puede encontrar la acción **Completar entrega** en el detalle de algunos pedidos cerrados con faltantes.

![Pantalla de registro de devolución](capturas/registrar_devolucion.png)

## 7. Funcionalidades del rol Depósito

### 7.1 Panel principal

El panel de Depósito muestra cuatro accesos principales:

- **Mis máquinas**.
- **Pedidos a gestionar**.
- **Máquinas en Servicio**.
- **Máquinas por Supervisor**.

Desde ese panel se realiza la operación cotidiana del área.

![Panel principal de Depósito](capturas/panel_deposito.png)

### 7.2 Visualizar pedidos pendientes

En **Pedidos a gestionar**, Depósito puede:

1. Ver todos los pedidos con destino Depósito.
2. Filtrar por estado.
3. Abrir el detalle de cada pedido.
4. Revisar solicitante, titular, resumen del pedido e historial.

Los filtros permiten separar rápidamente:

- Pendientes.
- Preparados.
- Entregados.
- Pendientes de confirmación.
- Cerrados.

![Listado de pedidos de Depósito](capturas/pedidos_deposito.png)

### 7.3 Asignar máquinas disponibles

Cuando un pedido está en estado **PENDIENTE_PREPARACION**, Depósito puede asignar máquinas.

Pasos:

1. Abrir el pedido.
2. Presionar **Asignar máquinas**.
3. Revisar el resumen de cantidades solicitadas por tipo.
4. Filtrar máquinas por tipo o por texto.
5. Seleccionar solo máquinas disponibles.
6. Si la asignación no coincide exactamente con lo solicitado, completar la justificación requerida.
7. Si corresponde, agregar una observación.
8. Confirmar la asignación.

Estados de máquina que suelen verse en esta pantalla:

- **Disponible**: se puede seleccionar.
- **Prestada / asignada**: no se puede seleccionar.
- **No devuelta**: no se puede seleccionar.
- **Fuera de servicio**: no se puede seleccionar.
- **En reparación**: no se puede seleccionar.
- **Baja**: no se puede seleccionar.

Resultado esperado:

- La máquina queda asociada al pedido.
- El pedido pasa a estado **PREPARADO**.

![Pantalla de asignación de máquinas](capturas/asignar_maquinas.png)

### 7.4 Confirmar entrega o preparación

Desde el detalle de un pedido, Depósito puede ejecutar acciones según el estado.

#### 7.4.1 Marcar como preparado

Si el pedido está en **PENDIENTE_PREPARACION**, la pantalla permite usar la acción **Marcar como PREPARADO**.

Observación importante:

- En la operatoria habitual, al asignar máquinas el pedido ya queda preparado.
- La acción manual de marcado como preparado debe utilizarse con criterio operativo.

#### 7.4.2 Marcar como entregado

Si el pedido está en **PREPARADO**, el usuario puede:

1. Completar una observación opcional de entrega.
2. Presionar **Marcar como ENTREGADO**.

Resultado esperado:

- El pedido pasa a estado **ENTREGADO**.


### 7.5 Confirmar devolución

Cuando una devolución ya fue informada por el Supervisor, Depósito debe confirmarla.

Pasos:

1. Abrir un pedido en estado **PENDIENTE_CONFIRMACION** o **PENDIENTE_CONFIRMACION_FALTANTES**.
2. Presionar **Confirmar devolución**.
3. Verificar las máquinas listadas.
4. Marcar las máquinas efectivamente devueltas.
5. Completar una observación si corresponde.
6. Presionar **Confirmar devolución**.

Resultado esperado:

- Si todo fue devuelto, el pedido queda **CERRADO**.
- Si faltan máquinas, queda constancia de faltantes y el proceso no se considera completamente normalizado.

Además, si el pedido tuvo destino Depósito y el Supervisor todavía no cargó la devolución, la interfaz permite registrar una **devolución directa** desde Depósito.

### 7.6 Registrar faltantes o inconsistencias

La detección de faltantes o diferencias se gestiona principalmente en dos momentos:

1. Durante la devolución, cuando no regresan todas las máquinas.
2. Durante la asignación, cuando no se entrega exactamente lo pedido.

Buenas prácticas para este caso:

1. Registrar la diferencia en la justificación u observación correspondiente.
2. Verificar con detalle qué máquina falta.
3. Confirmar solo lo efectivamente entregado o devuelto.
4. Revisar el historial del pedido para conservar trazabilidad.

## 7.7 Consultar máquinas por servicio

En **Máquinas en Servicio**, Depósito accede a una vista de solo lectura.

Permite:

1. Buscar un servicio.
2. Filtrar servicios con o sin máquinas asociadas.
3. Ordenar la información.
4. Abrir el detalle de un servicio.
5. Consultar las máquinas vinculadas a ese servicio.

Esta pantalla es útil para consulta operativa y no para edición.

![Pantalla de Máquinas en Servicio](capturas/maquinas_en_servicio.png)

### 7.8 Consultar máquinas por supervisor

En **Máquinas por Supervisor**, Depósito puede:

1. Seleccionar un supervisor desde un desplegable.
2. Ver sus servicios asignados.
3. Consultar **máquinas fijas** asociadas a sus servicios.
4. Consultar **máquinas temporales** asociadas a pedidos activos.

Esta vista sirve para entender qué máquinas corresponden al contexto habitual del supervisor y cuáles están asociadas a préstamos o movimientos temporales.

![Pantalla de Máquinas por Supervisor](capturas/maquinas_supervisor.png)

## 8. Funcionalidades del rol Administrador

### 8.1 Gestión de usuarios

En **Usuarios**, el Administrador puede:

1. Buscar por nombre o usuario.
2. Filtrar por rol.
3. Crear un usuario nuevo.
4. Editar un usuario existente.
5. Activar o desactivar usuarios.

#### Crear usuario

Pasos:

1. Ingresar a **Usuarios**.
2. Presionar **+ Nuevo**.
3. Completar usuario, nombre completo, rol y contraseña.
4. Presionar **Guardar**.

#### Editar usuario

Pasos:

1. Abrir un usuario del listado.
2. Modificar nombre, rol o contraseña.
3. Guardar los cambios.

#### Activar o desactivar usuario

Pasos:

1. Abrir un usuario existente.
2. Presionar **Desactivar usuario** o **Reactivar usuario**.
3. Confirmar la acción.

![Gestión de usuarios](capturas/usuarios.png)

### 8.2 Gestión de servicios

En **Servicios**, el Administrador puede:

1. Buscar servicios.
2. Filtrar por cantidad de máquinas asociadas.
3. Ordenar el listado.
4. Crear nuevos servicios.
5. Editar servicios existentes.
6. Eliminar servicios desde el listado.

En el formulario de edición también se puede visualizar el listado de máquinas pertenecientes al servicio.

Pasos para crear o editar:

1. Ingresar a **Servicios**.
2. Abrir un servicio existente o crear uno nuevo.
3. Completar el nombre del servicio.
4. Guardar.

![Gestión de servicios](capturas/servicios.png)

### 8.3 Asignación de servicios a supervisores y usuarios operativos

En **Supervisores x Servicios**, el Administrador puede definir qué servicios puede operar cada usuario habilitado para la operatoria.

Flujo de uso:

1. Ingresar a **Supervisores x Servicios**.
2. Seleccionar un supervisor desde el desplegable.
3. Revisar los servicios actualmente asignados.
4. Tildar o destildar los servicios habilitados.
5. Presionar **Guardar asignación**.

Impacto operativo:

- Un Supervisor solo puede crear pedidos para los servicios asignados.
- La asignación también condiciona la operatoria sobre máquinas según el servicio.

![Asignación de servicios a supervisores](capturas/supervisores_servicios.png)

### 8.4 Gestión de máquinas

En **Máquinas**, el Administrador puede:

1. Buscar por código, tipo, modelo, serie o servicio.
2. Filtrar por tipo y estado.
3. Visualizar resumen por estado.
4. Crear nuevas máquinas.
5. Editar máquinas existentes.
6. Cambiar estado.
7. Eliminar máquinas.

Datos principales de una máquina:

- Código.
- Tipo.
- Modelo.
- Serie.
- Servicio asociado.
- Estado.

En la edición, si la máquina tiene asignación activa, la pantalla informa a qué servicio y pedido está vinculada. También puede existir acceso a pedidos históricos de esa máquina.

![Formulario de alta o edición de máquina](capturas/nueva_maquina.png)

### 8.5 Visualización de pedidos

En **Pedidos**, el Administrador puede:

1. Visualizar todos los pedidos del sistema.
2. Buscar por código, supervisor, servicio o máquina.
3. Filtrar por estado.
4. Abrir el detalle completo de un pedido.
5. Consultar historial operativo.
6. Identificar pedidos con faltantes.

Desde el menú de acciones del listado, también puede ejecutar acciones administrativas sobre el pedido.

![Listado general de pedidos para Administración](capturas/listado_pedidos_admin.png)

### 8.6 Exportación de información

La pantalla de gestión de pedidos incluye la opción **Exportar pedidos (CSV)**.

Uso sugerido:

1. Ingresar a **Pedidos**.
2. Presionar **Exportar pedidos (CSV)**.
3. Abrir el archivo exportado con la herramienta habitual de planillas.
4. Utilizarlo para análisis, control o archivo.

![Pantalla de pedidos con opción de exportación](capturas/listado_pedidos_admin.png)


## 9. Flujo operativo completo

### 9.1 Pedido a Depósito

1. El Supervisor crea un pedido con destino **Depósito**.
2. El pedido queda en **PENDIENTE_PREPARACION**.
3. Depósito asigna máquinas.
4. El pedido pasa a **PREPARADO**.
5. Depósito marca la entrega.
6. El pedido pasa a **ENTREGADO**.
7. El Supervisor registra la devolución.
8. El pedido pasa a **PENDIENTE_CONFIRMACION**.
9. Depósito confirma la devolución.
10. El pedido queda **CERRADO** o se registran faltantes.

### 9.2 Préstamo entre supervisores

1. Un Supervisor crea un pedido con destino **Supervisor**.
2. El supervisor receptor visualiza el pedido en **Mis préstamos**.
3. El receptor asigna máquinas o prepara el pedido.
4. El receptor entrega las máquinas.
5. Quien recibió las máquinas registra la devolución.
6. El receptor confirma la devolución.
7. El pedido se cierra o queda trazado con faltantes.

## 10. Estados de los pedidos

| Estado | Significado operativo |
| --- | --- |
| PENDIENTE_PREPARACION | Pedido creado y pendiente de preparación o asignación |
| PREPARADO | El pedido ya fue preparado y está listo para entrega |
| ENTREGADO | Las máquinas fueron entregadas al destinatario |
| PENDIENTE_CONFIRMACION | La devolución fue registrada y espera confirmación del receptor |
| PENDIENTE_CONFIRMACION_FALTANTES | La devolución quedó asociada a faltantes o diferencias pendientes |
| CERRADO | El proceso del pedido finalizó |
| PENDIENTE_CANCELACION | Se solicitó una cancelación y espera definición |
| CANCELADO | El pedido fue cancelado |

## 11. Buenas prácticas de uso

Para una operación ordenada, se recomienda:

1. Crear siempre los pedidos desde el sistema y no por vías informales.
2. Seleccionar correctamente el destino del pedido antes de confirmarlo.
3. Verificar el servicio antes de solicitar máquinas.
4. Registrar observaciones cuando una entrega o devolución tenga particularidades.
5. Justificar toda diferencia entre lo solicitado, lo entregado y lo devuelto.
6. Confirmar devoluciones solo con verificación física de las máquinas.
7. Revisar el historial cuando exista una diferencia o reclamo.
8. Mantener actualizados estados, usuarios y servicios.
9. No compartir credenciales de acceso.

## 12. Preguntas frecuentes

### 12.1 No veo un servicio al crear un pedido

Probablemente el usuario no tenga ese servicio asignado. Solicitar validación al Administrador.

### 12.2 No puedo seleccionar una máquina en la asignación

La máquina puede estar en un estado no disponible, por ejemplo asignada, no devuelta, en reparación, fuera de servicio o dada de baja.

### 12.3 Registré una devolución incompleta

El sistema solicitará justificación cuando no se devuelvan todas las máquinas. Luego el receptor deberá confirmar la devolución y quedará trazabilidad del faltante.

### 12.4 ¿Qué diferencia hay entre Mis pedidos y Mis préstamos?

- **Mis pedidos**: pedidos creados por el usuario.
- **Mis préstamos**: pedidos recibidos desde otros supervisores.

### 12.5 ¿Qué hago si el sistema muestra que está iniciando y no avanza?

Esperar unos segundos y usar la opción **Reintentar** si está disponible.

### 12.6 ¿Dónde veo el historial de un pedido?

En el detalle del pedido, donde se registran las acciones realizadas durante el ciclo operativo.

## 13. Glosario

| Término | Definición |
| --- | --- |
| Pedido | Solicitud de máquinas creada en el sistema |
| Préstamo | Pedido cuyo destino es otro supervisor |
| Servicio | Área o frente operativo al que se vinculan máquinas y permisos |
| Titular | Usuario o destino responsable del pedido en el flujo actual |
| Máquinas fijas | Máquinas asociadas a los servicios habituales de un supervisor |
| Máquinas temporales | Máquinas vinculadas a pedidos activos o préstamos |
| Faltante | Máquina que no fue devuelta o no pudo confirmarse en la devolución |
| Historial | Registro cronológico de acciones realizadas sobre un pedido |


