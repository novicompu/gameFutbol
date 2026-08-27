const { Sequelize } = require('sequelize');
const { resolveConnection } = require('./connection');
require('dotenv').config();

// DB_HOST admite tanto el hostname suelto como una URL mysql:// completa
const db = resolveConnection(process.env.DB_HOST, {
  host: '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

if (db.fromUrl) {
  console.log(`MySQL: configuracion tomada de la URL en DB_HOST (host ${db.host}:${db.port}, base ${db.database})`);
}

const sequelize = new Sequelize(db.database, db.user, db.password, {
  host: db.host,
  port: db.port,
  dialect: 'mysql'
});

sequelize.authenticate()
  .then(() => console.log('Conectado a MySQL correctamente.'))
  .catch(err => console.error('No se pudo conectar a MySQL:', err));

module.exports = sequelize;
