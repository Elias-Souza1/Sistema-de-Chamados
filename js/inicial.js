// Mensagens rotativas do balão da página inicial
const mensagens = [
  "Quanto mais detalhes você adicionar, mais rápido seu chamado será resolvido. 📝",
  "Anexe arquivos ou prints para ajudar a equipe a entender melhor seu problema. 📎",
  "Antes de abrir um novo chamado, verifique o histórico. Pode haver uma solução pronta! 🔍",
  "Descreva o problema de forma clara. Isso agiliza o atendimento. ⚡",
  "Use categorias corretas para que o chamado chegue ao time certo. 🎯",
  "Mantenha suas informações de contato atualizadas. 📱",
  "Se o problema for resolvido, não esqueça de fechar o chamado. ✅"
];
const balao = document.getElementById("balao-mensagem");
let indice = 0;
function trocarMensagem() {
  balao.style.opacity = 0;
  balao.style.transform = "translateX(-50%) translateY(calc(-1 * var(--altura-subida))) scale(0.95)";
  setTimeout(() => {
    balao.textContent = mensagens[indice];
    balao.style.opacity = 1;
    balao.style.transform = "translateX(-50%) translateY(calc(-1 * var(--altura-subida))) scale(1)";
    indice = (indice + 1) % mensagens.length;
  }, 500);
}
if (balao) {
  setInterval(trocarMensagem, 10000);
}