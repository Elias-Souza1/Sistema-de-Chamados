// js/guard.js — proteção de páginas + fallback p/ admin
(() => {
  const path = (location.pathname || '').toLowerCase();
  const isLogin = path.endsWith('/login.html') || path.endsWith('\\login.html');

  // públicas
  if (isLogin) return;

  // carrega sessão
  let user = null, roles = [], permissions = [], auth = false;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null');
    roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
    permissions = JSON.parse(sessionStorage.getItem('permissions') || '[]');
    auth = sessionStorage.getItem('auth') === 'true';
  } catch {}
  const normRoles = (roles || []).map(r => String(r).toUpperCase());

  // fallback: se estiver logado como admin@local e vier sem roles, injeta ADMIN
  if ((!normRoles || normRoles.length === 0) && user?.email?.toLowerCase() === 'admin@local') {
    sessionStorage.setItem('roles', JSON.stringify(['ADMIN']));
  }

  // precisa estar logado
  if (!auth || !user) {
    location.href = './login.html';
    return;
  }

  // bloqueio de settings p/ não-admin
  const isSettings = path.endsWith('/settings.html') || path.endsWith('\\settings.html');
  const hasAdmin = JSON.parse(sessionStorage.getItem('roles') || '[]')
                      .map(r => String(r).toUpperCase())
                      .includes('ADMIN');

  if (isSettings && !hasAdmin) {
    location.href = './inicial.html';
    return;
  }

  // expõe globais convenientes
  window.currentUser = user;
  window.currentRoles = JSON.parse(sessionStorage.getItem('roles') || '[]');
  window.currentPermissions = permissions;
})();
