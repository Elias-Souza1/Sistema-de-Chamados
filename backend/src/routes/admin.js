// backend/src/routes/admin.js
import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// util simples: (no futuro, valide via JWT/role no backend)
const isAdminFromBody = (req) => {
  // enquanto não tem auth real: o front deve mandar isAdmin=true só se o usuário for ADMIN
  return req.body?.isAdmin === true;
};

// LISTAS para montar UI
router.get('/roles', async (_req, res) => {
  const [rows] = await pool.query('SELECT role_name FROM roles ORDER BY role_name');
  res.json(rows.map(r => r.role_name));
});
router.get('/permissions', async (_req, res) => {
  const [rows] = await pool.query('SELECT perm_code FROM permissions ORDER BY perm_code');
  res.json(rows.map(r => r.perm_code));
});

// ver papéis/permissões do usuário
router.get('/users/:id/roles', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.role_name
       FROM user_roles ur
       JOIN roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = ?`,
    [req.params.id]
  );
  res.json(rows.map(r => r.role_name));
});
router.get('/users/:id/perms', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT perm_code FROM v_user_effective_permissions WHERE user_id = ?`,
    [req.params.id]
  );
  res.json(rows.map(p => p.perm_code));
});

// GRANT / REVOKE ROLE
router.post('/users/:id/grant-role', async (req, res) => {
  if (!isAdminFromBody(req)) return res.status(403).json({ error: 'Somente ADMIN' });
  const { role_name } = req.body;
  if (!role_name) return res.status(400).json({ error: 'role_name obrigatório' });
  await pool.query('CALL sp_grant_role(?, ?)', [req.params.id, role_name]);
  res.json({ ok: true });
});
router.post('/users/:id/revoke-role', async (req, res) => {
  if (!isAdminFromBody(req)) return res.status(403).json({ error: 'Somente ADMIN' });
  const { role_name } = req.body;
  if (!role_name) return res.status(400).json({ error: 'role_name obrigatório' });
  await pool.query('CALL sp_revoke_role(?, ?)', [req.params.id, role_name]);
  res.json({ ok: true });
});

// GRANT / REVOKE PERMISSION
router.post('/users/:id/grant-perm', async (req, res) => {
  if (!isAdminFromBody(req)) return res.status(403).json({ error: 'Somente ADMIN' });
  const { perm_code } = req.body;
  if (!perm_code) return res.status(400).json({ error: 'perm_code obrigatório' });
  await pool.query('CALL sp_grant_permission(?, ?)', [req.params.id, perm_code]);
  res.json({ ok: true });
});
router.post('/users/:id/revoke-perm', async (req, res) => {
  if (!isAdminFromBody(req)) return res.status(403).json({ error: 'Somente ADMIN' });
  const { perm_code } = req.body;
  if (!perm_code) return res.status(400).json({ error: 'perm_code obrigatório' });
  await pool.query('CALL sp_revoke_permission(?, ?)', [req.params.id, perm_code]);
  res.json({ ok: true });
});

export default router;
