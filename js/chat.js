// Chat - lista de conversas + envio básico
const conversations = {
  "1234": [
    { type: 'received', text: "Olá, preciso de ajuda com meu acesso." },
    { type: 'sent', text: "Claro! Pode descrever melhor o problema?" }
  ],
  "5678": [
    { type: 'received', text: "Meu chamado não foi atualizado." }
  ]
};
let currentChat = "1234";

function addMessage(text, type = 'sent') {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const message = document.createElement('div');
  message.classList.add('message', type);
  message.innerHTML = `<div class="bubble"><p>${text}</p><span class="time">${time}</span></div>`;
  const messagesContainer = document.getElementById("messages");
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadConversation(chatId) {
  const chatTitle = document.getElementById("chatTitle");
  const messagesContainer = document.getElementById("messages");
  chatTitle.textContent = `#${chatId}`;
  messagesContainer.innerHTML = "";
  if (conversations[chatId]) {
    conversations[chatId].forEach(msg => addMessage(msg.text, msg.type));
  }
  currentChat = chatId;
}

function initChatPage(){
  document.querySelectorAll(".conversation-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".conversation-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      const chatId = item.getAttribute("data-id");
      loadConversation(chatId);
    });
  });

  document.getElementById("sendBtn")?.addEventListener("click", () => {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, 'sent');
    conversations[currentChat] = conversations[currentChat] || [];
    conversations[currentChat].push({ type: 'sent', text });
    input.value = "";
  });

  loadConversation("1234");
}
document.addEventListener('DOMContentLoaded', initChatPage);