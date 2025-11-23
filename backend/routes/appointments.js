/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Gestión de citas veterinarias
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/isAdmin");

// Helper function to validate date
function validateDate(date) {
  if (!date) {
    return null; // No date provided, validation passes
  }

  const appointmentDate = new Date(date);
  if (isNaN(appointmentDate.getTime())) {
    return { error: "Formato de fecha inválido" };
  }

  if (appointmentDate < new Date()) {
    return { error: "La fecha de la cita debe ser futura" };
  }

  return null; // Validation passes
}

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Crear una cita
 *     description: Permite a los usuarios crear citas para sus propias mascotas. Los administradores pueden crear citas para cualquier mascota.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pet_id
 *               - date
 *               - reason
 *             properties:
 *               pet_id:
 *                 type: integer
 *                 description: ID de la mascota
 *                 example: 1
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha y hora de la cita
 *                 example: "2024-12-01T10:00:00Z"
 *               reason:
 *                 type: string
 *                 description: Motivo de la cita
 *                 example: "Consulta general"
 *     responses:
 *       201:
 *         description: Cita creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 pet_id:
 *                   type: integer
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 reason:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: "scheduled"
 *       403:
 *         description: No tienes permiso para crear una cita para esta mascota
 *       500:
 *         description: Error del servidor
 */
router.post("/", auth, async (req, res) => {
  try {
    const { pet_id, date, reason } = req.body;

    // Validar campos requeridos
    if (!pet_id || !date || !reason) {
      return res.status(400).json({
        error: "Faltan campos obligatorios: pet_id, date y reason son requeridos",
      });
    }

    // Validar fecha
    const dateError = validateDate(date);
    if (dateError) {
      return res.status(400).json(dateError);
    }

    // Verificar permisos según el rol
    if (req.user.role !== "admin") {
      const petCheck = await pool.query(
        "SELECT * FROM pets WHERE id = $1 AND user_id = $2",
        [pet_id, req.user.id]
      );

      if (petCheck.rows.length === 0)
        return res.status(403).json({ error: "No puedes crear citas para esta mascota" });
    }

    const result = await pool.query(
      `INSERT INTO appointments (pet_id, date, reason, status)
       VALUES ($1, $2, $3, 'scheduled')
       RETURNING *`,
      [pet_id, date, reason]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Obtener todas las citas
 *     description: Los usuarios obtienen solo sus propias citas. Los administradores obtienen todas las citas del sistema.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de citas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   pet_id:
 *                     type: integer
 *                   date:
 *                     type: string
 *                     format: date-time
 *                   reason:
 *                     type: string
 *                   status:
 *                     type: string
 *                   pet_name:
 *                     type: string
 *                   owner:
 *                     type: string
 *                     description: Nombre del dueño (solo para administradores)
 *       500:
 *         description: Error del servidor
 */
router.get("/", auth, async (req, res) => {
  try {
    const result =
      req.user.role === "admin"
        ? await pool.query(
            `SELECT a.*, p.name AS pet_name, u.name AS owner 
             FROM appointments a
             JOIN pets p ON p.id = a.pet_id
             JOIN users u ON u.id = p.user_id
             ORDER BY date DESC`
          )
        : await pool.query(
            `SELECT a.*, p.name AS pet_name
             FROM appointments a
             JOIN pets p ON p.id = a.pet_id
             WHERE p.user_id = $1
             ORDER BY date DESC`,
            [req.user.id]
          );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Obtener una cita específica
 *     description: Los usuarios pueden ver solo sus propias citas. Los administradores pueden ver cualquier cita.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Detalles de la cita
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 pet_id:
 *                   type: integer
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 reason:
 *                   type: string
 *                 status:
 *                   type: string
 *                 user_id:
 *                   type: integer
 *       403:
 *         description: No tienes permiso para ver esta cita
 *       404:
 *         description: Cita no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.user_id 
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Cita no encontrada" });

    const appointment = result.rows[0];

    if (req.user.role !== "admin" && appointment.user_id !== req.user.id)
      return res.status(403).json({ error: "No puedes ver esta cita" });

    res.json(appointment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/**
 * @swagger
 * /api/appointments/{id}:
 *   patch:
 *     summary: Actualizar una cita
 *     description: Los usuarios pueden solicitar cambios en sus citas (cambia status a 'pending_change'). Los administradores pueden actualizar directamente cualquier cita.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Nueva fecha y hora
 *               reason:
 *                 type: string
 *                 description: Nuevo motivo
 *     responses:
 *       200:
 *         description: Cita actualizada o solicitud enviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 cita:
 *                   type: object
 *       403:
 *         description: No tienes permiso para modificar esta cita
 *       404:
 *         description: Cita no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/:id", auth, async (req, res) => {
  try {
    const { date, reason } = req.body;

    // Validar fecha si se proporciona
    const dateError = validateDate(date);
    if (dateError) {
      return res.status(400).json(dateError);
    }

    const appt = await pool.query(
      `SELECT a.*, p.user_id
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (appt.rows.length === 0)
      return res.status(404).json({ error: "Cita no encontrada" });

    const cita = appt.rows[0];

    if (req.user.role !== "admin") {
      if (cita.user_id !== req.user.id)
        return res.status(403).json({ error: "No puedes modificar esta cita" });

      // Guardar los cambios solicitados y cambiar el estado
      const solicitud = await pool.query(
        `UPDATE appointments
         SET status = 'pending_change',
             requested_date = COALESCE($1, requested_date),
             requested_reason = COALESCE($2, requested_reason)
         WHERE id = $3
         RETURNING *`,
        [date, reason, req.params.id]
      );

      return res.json({
        message: "Solicitud de cambio enviada al administrador",
        cita: solicitud.rows[0],
      });
    }

    // Admin puede actualizar directamente
    const result = await pool.query(
      `UPDATE appointments
       SET date = COALESCE($1, date),
           reason = COALESCE($2, reason),
           status = 'scheduled'
       WHERE id = $3
       RETURNING *`,
      [date, reason, req.params.id]
    );

    res.json({ message: "Cita actualizada por admin", cita: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Eliminar una cita
 *     description: Solo los administradores pueden eliminar citas del sistema.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Cita eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: Acceso denegado (solo administradores)
 *       500:
 *         description: Error del servidor
 */
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    // Verificar que la cita existe
    const check = await pool.query(
      "SELECT id FROM appointments WHERE id = $1",
      [req.params.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    await pool.query("DELETE FROM appointments WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ message: "Cita eliminada por administrador" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancelar una cita
 *     description: Los usuarios pueden cancelar sus propias citas. Los administradores pueden cancelar cualquier cita.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Cita cancelada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 cita:
 *                   type: object
 *       403:
 *         description: No tienes permiso para cancelar esta cita
 *       404:
 *         description: Cita no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const appt = await pool.query(
      `SELECT a.*, p.user_id
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (appt.rows.length === 0)
      return res.status(404).json({ error: "Cita no encontrada" });

    const cita = appt.rows[0];

    // Verificar permisos
    if (req.user.role !== "admin" && cita.user_id !== req.user.id)
      return res.status(403).json({ error: "No puedes cancelar esta cita" });

    // Actualizar estado a 'cancelled'
    const result = await pool.query(
      `UPDATE appointments
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    res.json({ message: "Cita cancelada exitosamente", cita: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}/approve:
 *   patch:
 *     summary: Aprobar cambio de cita
 *     description: Solo administradores pueden aprobar solicitudes de cambio de citas.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Nueva fecha y hora aprobada
 *               reason:
 *                 type: string
 *                 description: Nuevo motivo aprobado
 *     responses:
 *       200:
 *         description: Cambio aprobado exitosamente
 *       403:
 *         description: Acceso denegado (solo administradores)
 *       404:
 *         description: Cita no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/:id/approve", auth, isAdmin, async (req, res) => {
  try {
    const { date, reason } = req.body;

    const appt = await pool.query(
      `SELECT * FROM appointments WHERE id = $1`,
      [req.params.id]
    );

    if (appt.rows.length === 0)
      return res.status(404).json({ error: "Cita no encontrada" });

    const appointment = appt.rows[0];

    // Validar que la cita está en estado pending_change
    if (appointment.status !== "pending_change") {
      return res.status(400).json({
        error: "Solo se pueden aprobar citas con cambios pendientes",
      });
    }

    // Usar los cambios solicitados o los proporcionados por el admin
    const newDate = date || appointment.requested_date;
    const newReason = reason || appointment.requested_reason;

    // Validar fecha
    const dateError = validateDate(newDate);
    if (dateError) {
      return res.status(400).json(dateError);
    }

    const result = await pool.query(
      `UPDATE appointments
       SET date = COALESCE($1, date),
           reason = COALESCE($2, reason),
           status = 'scheduled',
           requested_date = NULL,
           requested_reason = NULL
       WHERE id = $3
       RETURNING *`,
      [newDate, newReason, req.params.id]
    );

    res.json({
      message: "Cambio aprobado exitosamente",
      cita: result.rows[0],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/appointments/{id}/reject:
 *   patch:
 *     summary: Rechazar cambio de cita
 *     description: Solo administradores pueden rechazar solicitudes de cambio de citas.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Cambio rechazado exitosamente
 *       403:
 *         description: Acceso denegado (solo administradores)
 *       404:
 *         description: Cita no encontrada
 *       500:
 *         description: Error del servidor
 */
router.patch("/:id/reject", auth, isAdmin, async (req, res) => {
  try {
    const appt = await pool.query(
      `SELECT * FROM appointments WHERE id = $1`,
      [req.params.id]
    );

    if (appt.rows.length === 0)
      return res.status(404).json({ error: "Cita no encontrada" });

    const appointment = appt.rows[0];

    // Validar que la cita está en estado pending_change
    if (appointment.status !== "pending_change") {
      return res.status(400).json({
        error: "Solo se pueden rechazar citas con cambios pendientes",
      });
    }

    // Rechazar cambios solicitados y restaurar el estado
    const result = await pool.query(
      `UPDATE appointments
       SET status = 'scheduled',
           requested_date = NULL,
           requested_reason = NULL
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    res.json({
      message: "Solicitud de cambio rechazada",
      cita: result.rows[0],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
