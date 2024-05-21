require('dotenv').config();
const { session } = require('express-session');
const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/sequelize');
const cors = require('cors');
const RedisSessions = require('redis-sessions').default;
const app = express();
const port = process.env.PORT || 3001;
const User = require('./models/Score');

// Configuración de RedisSessions
const rs = new RedisSessions({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  options: {
    password: process.env.REDIS_PASSWORD
  }
});

const rsApp = "myapp"; 

app.use(cors({
  origin: 'http://127.0.0.1:5500'
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/submit-login', async (req, res) => {
  const { cedula, nombre } = req.body;
  const totalScore = 0;

  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
  }

  try {
    // Verificar si la cédula ya existe en la base de datos
    const usuarioExistente = await User.findOne({ where: { cedula } });

    if (usuarioExistente) {
      console.log(`La cédula ${cedula} ya existe.`);
      return res.status(400).json({ error: 'La cédula ya está registrada' });
    }

    // Crear una nueva sesión en Redis
    const session = await rs.create({
      app: rsApp,
      id: cedula,
      ip: req.ip,
      ttl: 3600,
      d: { nombre, cedula, totalScore }
    });

    console.log('Sesión creada:', session.token);
    console.log(`Datos recibidos: cédula=${cedula}, nombre=${nombre}`);

    // Guardar los datos en la base de datos MySQL
    const nuevoUsuario = await User.create({ cedula, nombre, totalScore });

    res.json({ message: 'Datos recibidos y guardados correctamente', cedula, nombre, id: nuevoUsuario.id });

    const datosSesion = await rs.get({
      app: rsApp,
      token: session.token // Asegúrate de usar el campo correcto del token de la sesión
    });

    console.log('Datos de la sesión:', datosSesion);
  } catch (err) {
    console.error('Error al procesar los datos:', err);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al procesar los datos' });
    }
  }
});


app.listen(port, async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('Conexión a la base de datos establecida con éxito.');
  } catch (err) {
    console.error('No se pudo conectar a la base de datos:', err);
  }
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

app.post('/calculate-score', async (req, res) => {
  const { puntos, makeGoal, area, token } = req.body;

  if (!token) {
    console.error('Token faltante');
    return res.status(400).json({ error: 'Token es requerido' });
  }

  if (puntos === undefined || makeGoal === undefined || area === undefined) {
    console.error('Datos faltantes');
    return res.status(400).json({ error: 'Todos los datos son requeridos' });
  }

  try {
    // Recuperar session token
    const sessionData = await rs.get({
      app: rsApp,
      token: token
    });

    if (!sessionData) {
      console.error('Token no válido');
      return res.status(400).json({ error: 'Token no válido' });
    }

    console.log('Datos de la sesión:', sessionData);

    // Obtener el contador de tiros actual, si no existe inicializar en 0
    const currentThrow = sessionData.d.throwCount || 0;
    const nextThrow = currentThrow + 1;

    

    console.log(`Tiro almacenado en Redis: tiro=${nextThrow}, puntos=${puntos}, makeGoal=${makeGoal}, area=${area}`);

    // Obtener los datos actualizados de la sesión
    const updatedSessionData = await rs.get({
      app: rsApp,
      token: token
    });

    const totalAreaScore = Object.values(updatedSessionData.d).reduce((acc, val) => {
      const intVal = parseInt(val);
      if (isNaN(intVal)) {
        return acc;
      }
      return acc + intVal;
    }, 0);

    const scoreFactor = 2;
    const goalFactor = makeGoal ? 3 : 1;
    const areaFactor = Math.floor(area / 2);

    const calculatedPoints = Math.floor(puntos * scoreFactor * goalFactor * areaFactor);
    const totalScore = totalAreaScore + calculatedPoints;

    // Guardar el totalScore en Redis
    await rs.set({
      app: rsApp,
      token: token,
      d: {
        ...updatedSessionData.d,
        totalScore: totalScore
      }
    });

    res.json({ message: 'Tiro almacenado en Redis', totalScore: totalScore });
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});


// crear un metodo para guardar en mysql el total de puntos y los datos de la sesion
app.post('/save-score', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    console.error('Token faltante');
    return res.status(400).json({ error: 'Token es requerido' });
  }

  try {
    // Recuperar session token
    const sessionData = await rs.get({
      app: rsApp,
      token: token
    });

    if (!sessionData) {
      console.error('Token no válido');
      return res.status(400).json({ error: 'Token no válido' });
    }

    console.log('Datos de la sesión:', sessionData);

    const { cedula, nombre } = sessionData.d;
    const totalScore = sessionData.d.totalScore || 0;

    // actualizar la base de datos con los datos de la sesion
    await User.update({ totalScore }, { where: { cedula } });



    res.json({ message: 'Datos guardados correctamente', cedula, nombre, totalScore });
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al procesar los datos' });
  }
});
