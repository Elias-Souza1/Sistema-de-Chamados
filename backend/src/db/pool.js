// backend/src/db/pool.js
import dotenv from 'dotenv';
dotenv.config(); // <<<<< garante as envs antes de ler

import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[ENV ERRO] Variável ${k} não definida.`);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

export default pool;
