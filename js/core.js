// core.js - storage, auth, roles, grants

const STORE_KEYS = {
  USERS: 'sc_users',
  TICKETS: 'sc_tickets',
  SESSION: 'sc_session',
};

const ROLES = {
  ADMIN: 'ADMIN',
  AGENTE: 'AGENTE',
  USUARIO: 'USUARIO',
};

const DEFAULT_AGENT_GRANTS = {
  assignOthers: false,   // pode atribuir chamados a outros agentes
  respondOthers: false,  // pode responder chamados atribuídos a outros agentes
  reassignTickets: false,// pode desatribuir e reatribuir chamados entre agentes
  manageUsers: false,    // criar/excluir usuários
  changeRoles: false,    // mudar tipo de conta
};

function hashPass(p){ // mock hash
  try { return btoa(unescape(encodeURIComponent(p))); } catch { return p; }
}

// Seed initial data on first run:
(function seed(){
  const users = JSON.parse(localStorage.getItem(STORE_KEYS.USERS) || "null");
  if (!users || users.length === 0) {
    const admin = {
      id: crypto.randomUUID(),
      name: "Administrador",
      email: "admin@local",
      pass: hashPass("123456"),
      role: ROLES.ADMIN,
      grants: { assignOthers:true, respondOthers:true, reassignTickets:true, manageUsers:true, changeRoles:true }
    };
    localStorage.setItem(STORE_KEYS.USERS, JSON.stringify([admin]));
  }
  const tickets = JSON.parse(localStorage.getItem(STORE_KEYS.TICKETS) || "null");
  if (!tickets) {
    const arr = [
      { id: "1001", subject:"Erro na emissão de boleto", status:"Aberto", openedBy:null, assignedTo:null },
      { id: "1002", subject:"Atualização de plano", status:"Em andamento", openedBy:null, assignedTo:null },
      { id: "1003", subject:"Solicitação de reembolso", status:"Fechado", openedBy:null, assignedTo:null },
      { id: "1004", subject:"Problema de acesso ao sistema", status:"Aberto", openedBy:null, assignedTo:null },
    ];
    localStorage.setItem(STORE_KEYS.TICKETS, JSON.stringify(arr));
  }
})();

function getUsers(){ return JSON.parse(localStorage.getItem(STORE_KEYS.USERS) || "[]"); }
function saveUsers(list){ localStorage.setItem(STORE_KEYS.USERS, JSON.stringify(list)); }

function findUserByEmail(email){
  return getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

function currentSession(){
  try { return JSON.parse(sessionStorage.getItem(STORE_KEYS.SESSION) || "null"); }
  catch { return null; }
}
function setSession(user){
  sessionStorage.setItem(STORE_KEYS.SESSION, JSON.stringify({ uid: user.id, when: Date.now() }));
}
function clearSession(){ sessionStorage.removeItem(STORE_KEYS.SESSION); }

function getCurrentUser(){
  const s = currentSession();
  if (!s) return null;
  return getUsers().find(u => u.id === s.uid) || null;
}

function requireAuth(){
  const u = getCurrentUser();
  if (!u) { window.location.href = "./login.html"; }
  return u;
}

function hasGrant(user, grant){
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true; // admin tem tudo
  if (user.role === ROLES.AGENTE) {
    return !!(user.grants && user.grants[grant]);
  }
  return false;
}

function createUser({name, email, pass, role}){
  const users = getUsers();
  if (findUserByEmail(email)) throw new Error("E-mail já cadastrado.");
  const user = {
    id: crypto.randomUUID(),
    name: name || email.split("@")[0],
    email,
    pass: hashPass(pass),
    role: role || ROLES.USUARIO,
    grants: {...DEFAULT_AGENT_GRANTS},
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function updateUser(updated){
  const users = getUsers();
  const idx = users.findIndex(u => u.id === updated.id);
  if (idx === -1) throw new Error("Usuário não encontrado.");
  users[idx] = { ...users[idx], ...updated };
  saveUsers(users);
}

function deleteUser(userId){
  const users = getUsers().filter(u => u.id !== userId);
  saveUsers(users);
}

// Tickets helpers (simplificados)
function getTickets(){ return JSON.parse(localStorage.getItem(STORE_KEYS.TICKETS) || "[]"); }
function saveTickets(list){ localStorage.setItem(STORE_KEYS.TICKETS, JSON.stringify(list)); }
function setTicketAssign(id, uid){ const list = getTickets(); const t = list.find(x=>x.id===id); if(t){ t.assignedTo = uid; saveTickets(list);} }
function setTicketStatus(id, status){ const list = getTickets(); const t = list.find(x=>x.id===id); if(t){ t.status = status; saveTickets(list);} }