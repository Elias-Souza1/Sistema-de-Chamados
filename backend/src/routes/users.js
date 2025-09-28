import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

/**
 * GET /users
 * Lista usuários (simples).
 */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, full_name, email, is_active, created_at FROM users ORDER BY user_id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

/**
 * POST /users
 * Body: { full_name, email, password, role_name }
 * Cria usuário via procedure sp_create_user.
 */
router.post('/', async (req, res) => {
  const { full_name, email, password, role_name } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('CALL sp_create_user(?, ?, ?, ?)', [
      full_name, email, password, role_name || 'USUARIO'
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
