// js/sidebar.js — link ativo, logout, esconder item admin p/ não-admin + navegação robusta
(() => {
  // Marca link ativo
  const currentFile = (location.pathname.split('/').pop() || '').toLowerCase();
  document.querySelectorAll('.sidebar a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href.endsWith(currentFile) || href === location.pathname.toLowerCase()) {
      a.classList.add('active');
    }
  });

  // Esconde "Configurações" para não-admin
  let isAdmin = false;
  try {
    const roles = JSON.parse(sessionStorage.getItem('roles') || '[]')
      .map(r => String(r).toUpperCase());
    isAdmin = roles.includes('ADMIN');
  } catch {}
  const settingsLink = document.querySelector('.sidebar a[href$="settings.html"], .sidebar a[href$="/html/settings.html"]');
  if (settingsLink && !isAdmin) settingsLink.style.display = 'none';

  // Logout
  const logout = document.getElementById('logoutLink');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.clear();
      localStorage.removeItem('sc_session');
      location.href = '/html/login.html';
    });
  }

  // Força navegação mesmo se algum script fizer preventDefault
  document.querySelectorAll('.sidebar a[href]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const raw = a.getAttribute('href');
      if (!raw || raw === '#') return;

      let target = raw.trim();

      // se for relativo para html (ex.: "./settings.html" ou "settings.html"), torna absoluto
      const isHttp = /^https?:\/\//i.test(target);
      const isAbsolute = target.startsWith('/');
      const isHtml = /\.html(\?|#|$)/i.test(target);

      if (!isHttp && !isAbsolute && isHtml) {
        // mantém apenas o nome do arquivo e prefixa com /html/
        const file = target.replace(/^\.?\//, '').split('/').pop();
        target = `/html/${file}`;
      }

      ev.preventDefault();
      ev.stopImmediatePropagation(); // ignora outros handlers
      window.location.assign(target); // navega de qualquer jeito
    }, true); // fase de CAPTURA
  });
})();
