// js/settings.js — Admin: criar usuários + gerenciar papéis/permissões
(() => {
  // Use sempre a mesma origem do site (http://localhost:3000)
  const API = `${location.protocol}//${location.host}`;

  // ===== Helpers de sessão (mesma lógica do guard) =====
  function getSess() {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "null");
      const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
      const permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");
      const auth = sessionStorage.getItem("auth") === "true";
      return { user, roles, permissions, auth };
    } catch {
      return { user: null, roles: [], permissions: [], auth: false };
    }
  }

  // Bloqueio extra (guard já faz, mas reforçamos aqui)
  const sess = getSess();
  if (!sess.auth || !sess.roles?.includes("ADMIN")) {
    alert("Acesso restrito a administradores.");
    location.href = "./login.html";
    return;
  }

  // ===== Elements =====
  const elFullName     = document.getElementById("full_name");
  const elEmail        = document.getElementById("email");
  const elPassword     = document.getElementById("password");
  const elRoleInitial  = document.getElementById("role_name");
  const elBtnCreate    = document.getElementById("btnCreateUser");
  const elCreateMsg    = document.getElementById("createUserMsg");

  const elReloadUsers  = document.getElementById("btnReloadUsers");
  const elUsersTbody   = document.getElementById("usersTableBody");

  const elSelUser      = document.getElementById("selUser");
  const elRolesBox     = document.getElementById("rolesList");
  const elPermsBox     = document.getElementById("permsList");
  const elBtnReloadRP  = document.getElementById("btnReload");
  const elMsgRP        = document.getElementById("rolesPermsMsg");

  let allRoles = [];
  let allPerms = [];
  let currentUserId = null;

  // ===== API helpers =====
  async function apiGet(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function apiPost(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  // ===== Render: tabela de usuários =====
  function renderUsersTable(users) {
    elUsersTbody.innerHTML = "";
    if (!Array.isArray(users) || users.length === 0) return;

    const fr = document.createDocumentFragment();
    for (const u of users) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.user_id}</td>
        <td>${u.full_name || "-"}</td>
        <td>${u.email || "-"}</td>
        <td>${u.is_active ? "Sim" : "Não"}</td>
        <td>${formatDateTime(u.created_at)}</td>
      `;
      fr.appendChild(tr);
    }
    elUsersTbody.appendChild(fr);
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return iso;
    }
  }

  // ===== Render: select de usuários para papéis/perms =====
  function renderUserSelect(users) {
    elSelUser.innerHTML = `<option value="">Selecione...</option>`;
    if (!Array.isArray(users) || users.length === 0) return;

    const fr = document.createDocumentFragment();
    for (const u of users) {
      const opt = document.createElement("option");
      opt.value = u.user_id;
      opt.textContent = `${u.user_id} • ${u.full_name || u.email}`;
      fr.appendChild(opt);
    }
    elSelUser.appendChild(fr);
  }

  // ===== Papéis & Permissões (catálogos + do usuário) =====
  async function loadCatalogs() {
    const [roles, perms] = await Promise.all([
      apiGet(`${API}/admin/roles`),
      apiGet(`${API}/admin/permissions`)
    ]);
    allRoles = roles || [];
    allPerms = perms || [];
  }

  function renderRolesPermsCheckboxes(userRoles = [], userPerms = []) {
    // roles
    elRolesBox.innerHTML = "";
    const frR = document.createDocumentFragment();
    for (const r of allRoles) {
      const id = `role_${r}`;
      const div = document.createElement("div");
      div.innerHTML = `
        <label style="display:flex; gap:.5rem; align-items:center;">
          <input type="checkbox" id="${id}" value="${r}" ${userRoles.includes(r) ? "checked" : ""}>
          <span>${r}</span>
        </label>
      `;
      const input = div.querySelector("input");
      input.addEventListener("change", () => toggleRole(r, input.checked));
      frR.appendChild(div);
    }
    elRolesBox.appendChild(frR);

    // perms
    elPermsBox.innerHTML = "";
    const frP = document.createDocumentFragment();
    for (const p of allPerms) {
      const id = `perm_${p}`;
      const div = document.createElement("div");
      div.innerHTML = `
        <label style="display:flex; gap:.5rem; align-items:center;">
          <input type="checkbox" id="${id}" value="${p}" ${userPerms.includes(p) ? "checked" : ""}>
          <span>${p}</span>
        </label>
      `;
      const input = div.querySelector("input");
      input.addEventListener("change", () => togglePerm(p, input.checked));
      frP.appendChild(div);
    }
    elPermsBox.appendChild(frP);
  }

  async function onSelectUserChange() {
    const id = Number(elSelUser.value);
    if (!id) {
      currentUserId = null;
      elRolesBox.innerHTML = "";
      elPermsBox.innerHTML = "";
      return;
    }
    currentUserId = id;
    await renderRolesPermsForUser(id);
  }

  async function renderRolesPermsForUser(userId) {
    const [userRoles, userPerms] = await Promise.all([
      apiGet(`${API}/admin/users/${userId}/roles`),
      apiGet(`${API}/admin/users/${userId}/perms`)
    ]);
    renderRolesPermsCheckboxes(userRoles, userPerms);
  }

  async function toggleRole(role, checked) {
    if (!currentUserId) return;
    try {
      if (checked) {
        await apiPost(`${API}/admin/users/${currentUserId}/grant-role`, { role_name: role, isAdmin: true });
      } else {
        await apiPost(`${API}/admin/users/${currentUserId}/revoke-role`, { role_name: role, isAdmin: true });
      }
      statusMsg(elMsgRP, "Papéis atualizados.");
    } catch (e) {
      console.error(e);
      alert("Erro ao alterar papel. Recarregue a página.");
      await renderRolesPermsForUser(currentUserId);
    }
  }

  async function togglePerm(perm, checked) {
    if (!currentUserId) return;
    try {
      if (checked) {
        await apiPost(`${API}/admin/users/${currentUserId}/grant-perm`, { perm_code: perm, isAdmin: true });
      } else {
        await apiPost(`${API}/admin/users/${currentUserId}/revoke-perm`, { perm_code: perm, isAdmin: true });
      }
      statusMsg(elMsgRP, "Permissões atualizadas.");
    } catch (e) {
      console.error(e);
      alert("Erro ao alterar permissão. Recarregue a página.");
      await renderRolesPermsForUser(currentUserId);
    }
  }

  // ===== Criar usuário =====
  async function createUser() {
    const full_name = (elFullName.value || "").trim();
    const email     = (elEmail.value || "").trim();
    const password  = (elPassword.value || "").trim();
    const role_name = (elRoleInitial.value || "USUARIO").trim();

    if (!full_name || !email || !password) {
      alert("Preencha nome, e-mail e senha.");
      return;
    }
    elBtnCreate.disabled = true;
    try {
      await apiPost(`${API}/users`, { full_name, email, password, role_name });
      statusMsg(elCreateMsg, "Usuário criado.");
      elFullName.value = "";
      elEmail.value = "";
      elPassword.value = "";
      await reloadUsers();
    } catch (e) {
      console.error(e);
      alert("Erro ao criar usuário.");
    } finally {
      elBtnCreate.disabled = false;
    }
  }

  // ===== Recarregar lista de usuários =====
  async function reloadUsers() {
    const users = await apiGet(`${API}/users`);
    renderUsersTable(users);
    renderUserSelect(users);
  }

  // ===== UI helpers =====
  function statusMsg(el, msg, isError=false) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = "inline-block";
    el.style.color = isError ? "#c0392b" : "#1e8449";
    setTimeout(() => { el.style.display = "none"; }, 3500);
  }

  // ===== Bind eventos =====
  elBtnCreate?.addEventListener("click", createUser);
  elBtnReloadRP?.addEventListener("click", async () => {
    if (currentUserId) await renderRolesPermsForUser(currentUserId);
  });
  elReloadUsers?.addEventListener("click", reloadUsers);
  elSelUser?.addEventListener("change", onSelectUserChange);

  // ===== Boot =====
  (async () => {
    try {
      await loadCatalogs();
      await reloadUsers();          // preenche tabela e o select
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar usuários/roles/permissões.");
    }
  })();
})();
