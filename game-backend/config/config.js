module.exports = {
    development: {
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'Zafiro30', // Cambia 'your_password' a la contraseña de tu MySQL
      database: process.env.DB_NAME || 'dataGame',
      host: process.env.DB_HOST || '127.0.0.1',
      dialect: 'mysql'
    }
  };
  
  