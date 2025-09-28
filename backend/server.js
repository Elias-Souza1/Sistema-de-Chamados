// backend/server.js — estáticos + API com persistência robusta (data.json) + troca de senha
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// RAIZ do projeto (um nível acima da pasta /backend)
const ROOT = path.resolve(__dirname, '..');

// Subpastas opcionais
const HTML_DIR = path.join(ROOT, 'html');
const CSS_DIR  = path.join(ROOT, 'css');
const JS_DIR   = path.join(ROOT, 'js');

// ===== Persistência em arquivo =====
const DATA_FILE = path.join(__dirname, 'data.json');

function atomicWrite(file, obj){
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function backupAndReset(cause){
  try{
    if (fs.existsSync(DATA_FILE)) {
      const stamp = new Date().toISOString().replace(/[^\d]/g,'').slice(0,14);
      const bak = path.join(__dirname, `data.backup-${stamp}.json`);
      fs.copyFileSync(DATA_FILE, bak);
      console.warn('[data.json] inválido — backup salvo em:', bak, 'causa:', cause?.message);
    }
  }catch(e){
    console.error('Falha ao criar backup de data.json:', e);
  }
  const fresh = defaultMem();
  atomicWrite(DATA_FILE, fresh);
  return fresh;
}

function defaultMem(){
  const now = new Date().toISOString();
  return {
    users: [
      // seed ADMIN (senha: 123456)
      { user_id: 1, full_name: 'Admin', email: 'admin@local', password: '123456', is_active: 1, created_at: now },
    ],
    roles: ['USUARIO','AGENTE','ADMIN'],
    permissions: ['users.read','users.write','tickets.read','tickets.write','admin.panel'],
    userRoles: { "1": ['ADMIN'] },
    userPerms: { "1": ['users.read','users.write','tickets.read','tickets.write','admin.panel'] },
    nextUserId: 2,
    tickets: []
  };
}

function loadMem(){
  try{
    if (!fs.existsSync(DATA_FILE)) {
      const init = defaultMem();
      atomicWrite(DATA_FILE, init);
      console.log('[data.json] criado (seed inicial).');
      return init;
    }
    const txt = fs.readFileSync(DATA_FILE, 'utf8');
    const obj = JSON.parse(txt);

    // normalizações
    obj.users       ||= [];
    obj.roles       ||= ['USUARIO','AGENTE','ADMIN'];
    obj.permissions ||= ['users.read','users.write','tickets.read','tickets.write','admin.panel'];
    obj.userRoles   ||= {};
    obj.userPerms   ||= {};
    obj.tickets     ||= [];
    obj.nextUserId  ||= 2;

    console.log('[data.json] carregado, usuários:', obj.users.length);
    return obj;
  }catch(e){
    return backupAndReset(e);
  }
}

function saveMem(){
  try{ atomicWrite(DATA_FILE, mem); }
  catch(e){ console.error('Falha ao salvar data.json:', e); }
}

function seedAdminIfMissing(){
  const admin = mem.users.find(u => String(u.email).toLowerCase() === 'admin@local');
  if (!admin) {
    const now = new Date().toISOString();
    mem.users.unshift({ user_id: 1, full_name: 'Admin', email: 'admin@local', password: '123456', is_active: 1, created_at: now });
    mem.userRoles["1"] = mem.userRoles["1"] || ['ADMIN'];
    mem.userPerms["1"] = mem.userPerms["1"] || ['users.read','users.write','tickets.read','tickets.write','admin.panel'];
    if (!mem.nextUserId || mem.nextUserId <= 1) mem.nextUserId = 2;
    console.log('[seed] admin criado (não existia).');
    saveMem();
  } else {
    mem.userRoles["1"] ||= ['ADMIN'];
    mem.userPerms["1"] ||= ['users.read','users.write','tickets.read','tickets.write','admin.panel'];
  }
}

let mem = loadMem();
seedAdminIfMissing();

function ensureMaps(id){
  const k = String(id);
  mem.userRoles[k] ||= [];
  mem.userPerms[k] ||= [];
}

// ===== App =====
const app = express();
app.use(express.json());

// CORS
const allowList = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb){
    if (!origin) return cb(null, true);                // curl/Postman
    if (allowList.length === 0 || allowList.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  }
}));

// Estáticos (raiz e subpastas)
app.use('/html', express.static(HTML_DIR));
app.use('/html', express.static(ROOT));
app.use('/css',  express.static(CSS_DIR));
app.use('/css',  express.static(ROOT));
app.use('/js',   express.static(JS_DIR));
app.use('/js',   express.static(ROOT));
app.use(express.static(ROOT)); // opcional

// Atalhos
app.get('/health', (_req,res)=>res.json({ ok:true }));
app.get(['/', '/index', '/home', '/html'], (_req,res)=> res.redirect('/html/login.html'));
app.get('/html/login.html', (_req,res)=> {
  const a = path.join(ROOT, 'login.html');
  const b = path.join(HTML_DIR, 'login.html');
  res.sendFile(fs.existsSync(a) ? a : b);
});

// ===== Helpers simples =====
function requireAdminBody(req, res) {
  if (req.body?.isAdmin === true) return true;
  res.status(403).json({ error: 'Somente ADMIN' });
  return false;
}
function isStrong(pw){
  // regra simples pra exemplo — ajuste se quiser mais rígido
  return typeof pw === 'string' && pw.trim().length >= 6;
}

// ===== Auth =====
app.post('/auth/login', (req,res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  const u = mem.users.find(x => x.is_active && String(x.email).toLowerCase() === String(email).toLowerCase());
  if (!u) return res.status(401).json({ error: 'Usuário não encontrado/ativo' });
  if (u.password !== password) return res.status(401).json({ error: 'Senha inválida' });
  ensureMaps(u.user_id);
  const roles = mem.userRoles[String(u.user_id)];
  const permissions = mem.userPerms[String(u.user_id)];
  const { password: _pw, ...user } = u;
  res.json({ user, roles, permissions });
});

// Self-service: troca de senha do PRÓPRIO usuário (informa senha atual)
app.post('/auth/change-password', (req,res) => {
  const { email, current_password, new_password } = req.body || {};
  if (!email || !current_password || !new_password)
    return res.status(400).json({ error: 'Informe e-mail, senha atual e nova senha.' });

  const idx = mem.users.findIndex(u => u.is_active && String(u.email).toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado/ativo' });

  const u = mem.users[idx];
  if (u.password !== current_password) return res.status(401).json({ error: 'Senha atual incorreta' });
  if (!isStrong(new_password)) return res.status(400).json({ error: 'Nova senha muito fraca (mín. 6 caracteres)' });

  mem.users[idx] = { ...u, password: new_password };
  saveMem();
  res.json({ ok: true });
});

// ===== Users =====
app.get('/users', (_req,res) => {
  res.json(mem.users.map(u => ({ ...u, password: undefined })));
});

app.post('/users', (req,res) => {
  const { full_name, email, password, role_name } = req.body || {};
  if (!full_name || !email || !password)
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });

  if (mem.users.some(u => String(u.email).toLowerCase() === String(email).toLowerCase()))
    return res.status(409).json({ error: 'E-mail já cadastrado' });

  const user_id = mem.nextUserId++;
  const user = { user_id, full_name, email, password, is_active: 1, created_at: new Date().toISOString() };
  mem.users.unshift(user);
  ensureMaps(user_id);
  const r = (role_name || 'USUARIO').toUpperCase();
  if (!mem.userRoles[String(user_id)].includes(r)) mem.userRoles[String(user_id)].push(r);
  if (!mem.userPerms[String(user_id)].includes('tickets.read')) mem.userPerms[String(user_id)].push('tickets.read');

  saveMem();
  res.status(201).json({ ok: true, user_id });
});

// ===== Catálogos =====
app.get('/admin/roles', (_req,res)=> res.json(mem.roles));
app.get('/admin/permissions', (_req,res)=> res.json(mem.permissions));

// ===== Por usuário =====
app.get('/admin/users/:id/roles', (req,res)=> {
  const id = String(Number(req.params.id));
  ensureMaps(id);
  res.json(mem.userRoles[id]);
});
app.get('/admin/users/:id/perms', (req,res)=> {
  const id = String(Number(req.params.id));
  ensureMaps(id);
  res.json(mem.userPerms[id]);
});

// Admin: GRANT/REVOKE role/perm
app.post('/admin/users/:id/grant-role', (req,res)=> {
  if (!requireAdminBody(req,res)) return;
  const id = String(Number(req.params.id));
  const { role_name } = req.body || {};
  if (!role_name) return res.status(400).json({ error: 'role_name obrigatório' });
  ensureMaps(id);
  if (!mem.userRoles[id].includes(role_name)) mem.userRoles[id].push(role_name);
  saveMem();
  res.json({ ok: true });
});
app.post('/admin/users/:id/revoke-role', (req,res)=> {
  if (!requireAdminBody(req,res)) return;
  const id = String(Number(req.params.id));
  const { role_name } = req.body || {};
  if (!role_name) return res.status(400).json({ error: 'role_name obrigatório' });
  ensureMaps(id);
  mem.userRoles[id] = mem.userRoles[id].filter(r => r !== role_name);
  saveMem();
  res.json({ ok: true });
});
app.post('/admin/users/:id/grant-perm', (req,res)=> {
  if (!requireAdminBody(req,res)) return;
  const id = String(Number(req.params.id));
  const { perm_code } = req.body || {};
  if (!perm_code) return res.status(400).json({ error: 'perm_code obrigatório' });
  ensureMaps(id);
  if (!mem.userPerms[id].includes(perm_code)) mem.userPerms[id].push(perm_code);
  saveMem();
  res.json({ ok: true });
});
app.post('/admin/users/:id/revoke-perm', (req,res)=> {
  if (!requireAdminBody(req,res)) return;
  const id = String(Number(req.params.id));
  const { perm_code } = req.body || {};
  if (!perm_code) return res.status(400).json({ error: 'perm_code obrigatório' });
  ensureMaps(id);
  mem.userPerms[id] = mem.userPerms[id].filter(p => p !== perm_code);
  saveMem();
  res.json({ ok: true });
});

// ===== Admin: SET PASSWORD (qualquer usuário) =====
app.post('/admin/users/:id/set-password', (req,res) => {
  if (!requireAdminBody(req,res)) return;
  const id = Number(req.params.id);
  const { new_password } = req.body || {};
  if (!new_password) return res.status(400).json({ error: 'new_password obrigatório' });
  if (!isStrong(new_password)) return res.status(400).json({ error: 'Nova senha muito fraca (mín. 6 caracteres)' });

  const idx = mem.users.findIndex(u => u.user_id === id);
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

  const u = mem.users[idx];
  mem.users[idx] = { ...u, password: new_password };
  saveMem();
  res.json({ ok: true });
});

// ===== Tickets (stubs) =====
app.get('/tickets', (_req,res)=> res.json(mem.tickets));
app.post('/tickets', (req,res)=>{
  const { subject, description, opened_by, priority } = req.body || {};
  if (!subject || !opened_by) return res.status(400).json({error:'subject e opened_by obrigatórios'});
  const id = mem.tickets.length + 1;
  const t = { ticket_id:id, subject, description, opened_by, assigned_to:null, status:'Aberto', priority: priority||'Média', created_at:new Date().toISOString() };
  mem.tickets.unshift(t);
  saveMem();
  res.status(201).json({ ok:true, ticket_id:id });
});

// Start
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Servidor ON em http://localhost:${port}`);
  console.log(`STATIC ROOT => ${ROOT}`);
  console.log(`DATA FILE   => ${DATA_FILE}`);
  console.log(`Abra: http://localhost:${port}/html/login.html`);
});
