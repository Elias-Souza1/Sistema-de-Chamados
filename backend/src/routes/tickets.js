import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

/**
 * GET /tickets
 * Lista tickets simples.
 */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.ticket_id, t.subject, t.status, t.priority, t.opened_at,
              u.full_name AS opened_by_name,
              a.full_name AS assigned_to_name
         FROM tickets t
         JOIN users u ON u.user_id = t.opened_by
         LEFT JOIN users a ON a.user_id = t.assigned_to
        ORDER BY t.ticket_id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Tickets list error:', err);
    res.status(500).json({ error: 'Erro ao listar tickets' });
  }
});

/**
 * POST /tickets
 * Body: { subject, description, opened_by, priority }
 * Cria ticket via sp_create_ticket.
 */
router.post('/', async (req, res) => {
  const { subject, description, opened_by, priority } = req.body;
  if (!subject || !opened_by) {
    return res.status(400).json({ error: 'Assunto e opened_by são obrigatórios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('CALL sp_create_ticket(?, ?, ?, ?)', [
      subject, description || null, opened_by, priority || 'Média'
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Erro ao criar ticket' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * PUT /tickets/:id/assign
 * Body: { actor_id, assignee_id }
 */
router.put('/:id/assign', async (req, res) => {
  const ticket_id = Number(req.params.id);
  const { actor_id, assignee_id } = req.body;
  if (!ticket_id || !actor_id || !assignee_id) {
    return res.status(400).json({ error: 'ticket_id, actor_id e assignee_id são obrigatórios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('CALL sp_assign_ticket(?, ?, ?)', [ticket_id, actor_id, assignee_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Assign ticket error:', err);
    res.status(500).json({ error: 'Erro ao atribuir ticket' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * PUT /tickets/:id/status
 * Body: { actor_id, new_status }
 */
router.put('/:id/status', async (req, res) => {
  const ticket_id = Number(req.params.id);
  const { actor_id, new_status } = req.body;
  if (!ticket_id || !actor_id || !new_status) {
    return res.status(400).json({ error: 'ticket_id, actor_id e new_status são obrigatórios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('CALL sp_update_ticket_status(?, ?, ?)', [ticket_id, actor_id, new_status]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
