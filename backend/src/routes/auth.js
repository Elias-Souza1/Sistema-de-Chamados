// backend/src/routes/auth.js
import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

/**
 * POST /auth/login
 * Body: { email: string, password?: string, plainPassword?: string }
 */
router.post('/login', async (req, res) => {
  const { email, password, plainPassword } = req.body;
  const pass = (password ?? plainPassword ?? '').toString();

  if (!email || !pass) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1) zera OUT e chama a procedure
    await conn.query('SET @uid = NULL');
    await conn.query('CALL sp_authenticate(?, ?, @uid)', [email, pass]);

    // 2) lê o OUT
    const [outRows] = await conn.query('SELECT @uid AS uid');
    const uid = outRows?.[0]?.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // 3) dados do usuário
    const [[user]] = await conn.query(
      `SELECT user_id, full_name, email, is_active
         FROM users
        WHERE user_id = ?
        LIMIT 1`,
      [uid]
    );

    // 4) papéis
    const [rolesRows] = await conn.query(
      `SELECT r.role_name
         FROM user_roles ur
         JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = ?`,
      [uid]
    );
    const roles = rolesRows.map(r => r.role_name);

    // 5) permissões efetivas (sua view)
    const [permRows] = await conn.query(
      `SELECT perm_code
         FROM v_user_effective_permissions
        WHERE user_id = ?`,
      [uid]
    );
    const permissions = permRows.map(p => p.perm_code);

    return res.json({ user, roles, permissions });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
