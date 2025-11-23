# Módulo de Citas (Appointments) - Documentación

## Descripción General

El módulo de citas proporciona funcionalidad completa para gestionar citas veterinarias con control de acceso basado en roles (usuarios regulares y administradores).

## Características Principales

### Control de Acceso Basado en Roles

#### Usuarios Regulares
- ✅ Crear citas solo para sus propias mascotas
- ✅ Ver solo sus propias citas
- ✅ Solicitar cambios en sus citas (genera estado `pending_change`)
- ✅ Cancelar sus propias citas

#### Administradores
- ✅ Crear citas para cualquier mascota
- ✅ Ver todas las citas del sistema
- ✅ Actualizar directamente cualquier cita
- ✅ Cancelar cualquier cita
- ✅ Aprobar solicitudes de cambio de usuarios
- ✅ Rechazar solicitudes de cambio de usuarios
- ✅ Eliminar citas del sistema

## Endpoints Disponibles

### 1. Crear Cita
**POST** `/api/appointments`

**Autenticación:** Requerida (Bearer Token)

**Body:**
```json
{
  "pet_id": 1,
  "date": "2024-12-01T10:00:00Z",
  "reason": "Consulta general"
}
```

**Validaciones:**
- ✅ Todos los campos son obligatorios
- ✅ La fecha debe ser válida y futura
- ✅ Usuario debe ser dueño de la mascota (excepto admins)

**Respuestas:**
- `201`: Cita creada exitosamente
- `400`: Campos faltantes o fecha inválida
- `403`: Sin permiso para crear cita para esa mascota
- `500`: Error del servidor

---

### 2. Listar Citas
**GET** `/api/appointments`

**Autenticación:** Requerida (Bearer Token)

**Comportamiento por Rol:**
- **Usuario:** Retorna solo sus propias citas
- **Admin:** Retorna todas las citas del sistema con información del dueño

**Respuesta exitosa (200):**
```json
[
  {
    "id": 1,
    "pet_id": 1,
    "date": "2024-12-01T10:00:00Z",
    "reason": "Consulta general",
    "status": "scheduled",
    "pet_name": "Firulais",
    "owner": "Juan Pérez"  // Solo para admin
  }
]
```

---

### 3. Obtener Cita Específica
**GET** `/api/appointments/:id`

**Autenticación:** Requerida (Bearer Token)

**Parámetros:**
- `id`: ID de la cita

**Control de Acceso:**
- Usuario solo puede ver sus propias citas
- Admin puede ver cualquier cita

**Respuestas:**
- `200`: Detalles de la cita
- `403`: Sin permiso para ver esta cita
- `404`: Cita no encontrada

---

### 4. Actualizar Cita
**PATCH** `/api/appointments/:id`

**Autenticación:** Requerida (Bearer Token)

**Body:**
```json
{
  "date": "2024-12-02T11:00:00Z",
  "reason": "Vacunación"
}
```

**Comportamiento por Rol:**
- **Usuario:** Cambia el estado a `pending_change` (solicitud al admin)
- **Admin:** Actualiza directamente la cita con estado `scheduled`

**Respuestas:**
- `200`: Cita actualizada o solicitud enviada
- `403`: Sin permiso para modificar la cita
- `404`: Cita no encontrada

---

### 5. Cancelar Cita
**PATCH** `/api/appointments/:id/cancel`

**Autenticación:** Requerida (Bearer Token)

**Descripción:** Cambia el estado de la cita a `cancelled`

**Control de Acceso:**
- Usuario puede cancelar sus propias citas
- Admin puede cancelar cualquier cita

**Respuestas:**
- `200`: Cita cancelada exitosamente
- `403`: Sin permiso para cancelar esta cita
- `404`: Cita no encontrada

---

### 6. Aprobar Cambio de Cita
**PATCH** `/api/appointments/:id/approve`

**Autenticación:** Requerida (Bearer Token + Admin)

**Body:**
```json
{
  "date": "2024-12-02T11:00:00Z",
  "reason": "Vacunación"
}
```

**Descripción:** Aprueba una solicitud de cambio y actualiza la cita con los nuevos datos

**Respuestas:**
- `200`: Cambio aprobado exitosamente
- `403`: Acceso denegado (solo administradores)
- `404`: Cita no encontrada

---

### 7. Rechazar Cambio de Cita
**PATCH** `/api/appointments/:id/reject`

**Autenticación:** Requerida (Bearer Token + Admin)

**Descripción:** Rechaza una solicitud de cambio y mantiene la cita original con estado `scheduled`

**Respuestas:**
- `200`: Solicitud rechazada
- `403`: Acceso denegado (solo administradores)
- `404`: Cita no encontrada

---

### 8. Eliminar Cita
**DELETE** `/api/appointments/:id`

**Autenticación:** Requerida (Bearer Token + Admin)

**Descripción:** Elimina permanentemente una cita del sistema (solo administradores)

**Respuestas:**
- `200`: Cita eliminada exitosamente
- `403`: Acceso denegado (solo administradores)
- `500`: Error del servidor

---

## Estados de Cita

El módulo utiliza los siguientes estados:

| Estado | Descripción |
|--------|-------------|
| `scheduled` | Cita programada y confirmada |
| `pending_change` | Usuario ha solicitado un cambio, pendiente de aprobación del admin |
| `cancelled` | Cita cancelada por usuario o admin |

## Flujo de Trabajo

### Flujo de Usuario Regular

1. **Crear cita** → Estado: `scheduled`
2. **Solicitar cambio** → Estado: `pending_change`
3. **Esperar aprobación del admin**
   - Si aprueba → Estado: `scheduled` (con nuevos datos)
   - Si rechaza → Estado: `scheduled` (datos originales)
4. **Cancelar** → Estado: `cancelled`

### Flujo de Administrador

1. **Ver todas las citas del sistema**
2. **Crear citas para cualquier mascota**
3. **Actualizar directamente cualquier cita**
4. **Aprobar/Rechazar solicitudes de cambio**
5. **Cancelar o eliminar citas**

## Documentación Swagger

Toda la API está documentada con Swagger/OpenAPI. Para ver la documentación interactiva:

1. Iniciar el servidor
2. Visitar: `http://localhost:4000/api-docs`
3. Buscar la sección "Appointments"

## Seguridad

- ✅ Autenticación JWT requerida en todos los endpoints
- ✅ Validación de roles (usuario/admin)
- ✅ Verificación de propiedad de recursos
- ✅ Validación de entrada de datos
- ✅ Protección contra inyección SQL mediante queries parametrizadas

## Ejemplo de Uso con cURL

### Crear una cita (Usuario)
```bash
curl -X POST http://localhost:4000/api/appointments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pet_id": 1,
    "date": "2024-12-01T10:00:00Z",
    "reason": "Consulta general"
  }'
```

### Listar mis citas
```bash
curl -X GET http://localhost:4000/api/appointments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cancelar una cita
```bash
curl -X PATCH http://localhost:4000/api/appointments/1/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Aprobar cambio (Admin)
```bash
curl -X PATCH http://localhost:4000/api/appointments/1/approve \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-12-02T11:00:00Z",
    "reason": "Vacunación"
  }'
```

## Dependencias

- Express.js
- PostgreSQL (pg)
- JWT (jsonwebtoken)
- Middleware de autenticación personalizado
- Middleware de autorización de admin

## Base de Datos

### Tabla: appointments
```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER REFERENCES pets(id),
  date TIMESTAMP NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  requested_date TIMESTAMP,
  requested_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index para mejor rendimiento en consultas por estado
CREATE INDEX idx_appointments_status ON appointments(status);
```

### Campos de la Tabla

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único de la cita |
| `pet_id` | INTEGER | ID de la mascota (FK a pets) |
| `date` | TIMESTAMP | Fecha y hora actual de la cita |
| `reason` | TEXT | Motivo actual de la cita |
| `status` | VARCHAR(50) | Estado de la cita (scheduled, pending_change, cancelled) |
| `requested_date` | TIMESTAMP | Fecha solicitada para cambio (pendiente de aprobación) |
| `requested_reason` | TEXT | Motivo solicitado para cambio (pendiente de aprobación) |
| `created_at` | TIMESTAMP | Fecha de creación del registro |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

### Relaciones
- `appointments.pet_id` → `pets.id`
- `pets.user_id` → `users.id`

### Migración Requerida

Para aplicar los cambios necesarios en la base de datos:

```bash
psql $DATABASE_URL < backend/migrations/add_requested_fields_to_appointments.sql
```

O ejecutar manualmente:
```sql
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS requested_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS requested_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
```

## Mantenimiento y Extensión

Para agregar nuevas funcionalidades:

1. Agregar el endpoint en `appointments.js`
2. Implementar validaciones necesarias
3. Agregar control de acceso basado en roles
4. Documentar con Swagger JSDoc
5. Actualizar esta documentación

---

**Última actualización:** 2024-11-23
