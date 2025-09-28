// Tickets - enhanced with role-based actions
document.addEventListener('DOMContentLoaded', () => {
  const me = requireAuth();

  const statusFilter = document.getElementById('filterStatus');
  const prioridadeFilter = document.getElementById('filterPrioridade');
  const responsavelFilter = document.getElementById('filterResponsavel');
  const searchInput = document.getElementById('searchAssunto');
  const tbody = document.querySelector('#tabelaTickets tbody');

  function render(){
    const tickets = getTickets();
    const users = getUsers();
    tbody.innerHTML = '';
    tickets.forEach(t => {
      const assignee = users.find(u => u.id === t.assignedTo);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${t.id}</td>
        <td>${t.subject}</td>
        <td>${t.status}</td>
        <td>${assignee ? assignee.name : '-'}</td>
        <td>${t.priority || '-'}</td>
        <td>${t.openedAt || '-'}</td>
      `;
      // actions cell for agents/admins
      const actions = document.createElement('td');
      const canAssignSelf = (me.role===ROLES.AGENTE || me.role===ROLES.ADMIN);
      const canAssignOthers = hasGrant(me,'assignOthers') || me.role===ROLES.ADMIN;
      const canReassign = hasGrant(me,'reassignTickets') || me.role===ROLES.ADMIN;

      if (canAssignSelf){
        const b = document.createElement('button');
        b.textContent = 'Assumir';
        b.className = 'btn-submit';
        b.style.cssText = 'width:auto;padding:0.3rem 0.6rem;margin-right:6px;';
        b.onclick = ()=>{ setTicketAssign(t.id, me.id); render(); };
        actions.appendChild(b);
      }
      if (canAssignOthers){
        const sel = document.createElement('select');
        sel.innerHTML = `<option value="">Atribuir a...</option>` + users.filter(u=>u.role===ROLES.AGENTE || u.role===ROLES.ADMIN).map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
        sel.onchange = ()=>{ if(sel.value){ setTicketAssign(t.id, sel.value); render(); } };
        actions.appendChild(sel);
      }
      if (t.status!=='Fechado' && (me.role!==ROLES.USUARIO)){
        const f = document.createElement('button');
        f.textContent = 'Finalizar';
        f.className = 'btn-submit';
        f.style.cssText = 'width:auto;padding:0.3rem 0.6rem;margin-left:6px;background:#28a745;';
        f.onclick = ()=>{ setTicketStatus(t.id, 'Fechado'); render(); };
        actions.appendChild(f);
      }
      if (canReassign){
        const r = document.createElement('button');
        r.textContent = 'Reatribuir';
        r.className = 'btn-submit';
        r.style.cssText = 'width:auto;padding:0.3rem 0.6rem;margin-left:6px;background:#6c757d;';
        r.onclick = ()=>{ setTicketAssign(t.id, null); render(); };
        actions.appendChild(r);
      }
      // append actions column
      const ths = document.querySelectorAll('#tabelaTickets thead tr th');
      if (ths.length < 7){
        const th = document.createElement('th'); th.textContent = 'Ações';
        document.querySelector('#tabelaTickets thead tr').appendChild(th);
      }
      row.appendChild(actions);
      tbody.appendChild(row);
    });
  }

  function filtrar(){
    // Keep simple for prototype (filtering on render not implemented)
    render();
  }

  statusFilter?.addEventListener('change', filtrar);
  prioridadeFilter?.addEventListener('change', filtrar);
  responsavelFilter?.addEventListener('change', filtrar);
  searchInput?.addEventListener('input', filtrar);

  render();
});