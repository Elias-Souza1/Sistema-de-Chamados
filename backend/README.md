# Ticket API Backend (Node + Express + MySQL)

## 1) Pré-requisitos
- MySQL 8.0+ com o schema `chamados` já criado (use o `chamados_db.sql` que te enviei).
- Node.js 18+

## 2) Configuração
```bash
cd ticket_api_backend
cp .env.example .env
# edite .env com suas credenciais do MySQL
```

## 3) Instalar deps e rodar
```bash
npm i
npm run dev
```
A API sobe em `http://localhost:3000`.

## 4) Endpoints
- `POST /auth/login` → body: `{ "email": "", "password": "" }`
- `POST /auth/register` → body: `{ "full_name": "", "email": "", "password": "" }` (cria USUÁRIO)
- `GET /users` → lista usuários
- `POST /users/:userId/role` → body: `{ "role": "ADMIN|AGENTE|USUARIO" }`
- `DELETE /users/:userId/role` → body: `{ "role": "..." }`
- `POST /users/:userId/grant` → body: `{ "perm": "ASSIGN_OTHERS|RESPOND_OTHERS|REASSIGN_TICKETS|MANAGE_USERS|CHANGE_ROLES" }`
- `DELETE /users/:userId/grant` → body: `{ "perm": "..." }`
- `GET /tickets` → lista tickets
- `POST /tickets` → body: `{ "subject": "", "description": "", "opened_by": 1, "priority": "Média" }`
- `POST /tickets/:id/assign` → body: `{ "actor_id": 1, "assignee_id": 2 }`
- `POST /tickets/:id/status` → body: `{ "actor_id": 1, "status": "Em andamento" }`

> Autenticação JWT não incluída (protótipo). Adapte conforme necessário.