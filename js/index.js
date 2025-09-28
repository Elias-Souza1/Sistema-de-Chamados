// js/index.js — integrar criação de chamado à API real
(() => {
  const API = "http://localhost:3000";

  const form = document.getElementById("formChamado");
  const successMessage = document.getElementById("successMessage");
  if (!form) return;

  // exige sessão: usamos o user_id para enviar opened_by
  const sessUser = JSON.parse(sessionStorage.getItem("user") || "null");
  if (!sessUser) {
    alert("Sessão expirada. Faça login novamente.");
    location.replace("./login.html");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = document.getElementById("assunto").value.trim();
    const description = document.getElementById("descricao").value.trim();
    if (!subject || !description) {
      alert("Preencha assunto e descrição.");
      return;
    }

    try {
      const res = await fetch(`${API}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          opened_by: sessUser.user_id,  // <- OBRIGATÓRIO no backend
          priority: "Média"             // opcional; backend tem default
        }),
      });
      const data = await res.json();
      if (!res.ok) throw data;

      successMessage.style.display = "block";
      form.reset();
      document.getElementById("status").value = "Aberto";
      setTimeout(() => { successMessage.style.display = "none"; }, 3000);
    } catch (err) {
      alert(err?.error || "Falha ao criar chamado.");
      console.error(err);
    }
  });
})();
