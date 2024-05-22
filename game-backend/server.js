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
const CryptoJS = require('crypto-js');


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
  origin: '*',
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
      // Return 200 (OK) instead of 400 (Bad Request)
      return res.status(200).json({ message: 'Usuario ya registrado' });
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

    // Devolver el token de la sesión
    res.json({ message: 'Datos recibidos y guardados correctamente', token: session.token });

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
  const { dataGame } = req.body;

  console.log('Datos del juego:', dataGame);
  if (!dataGame) {
    console.error('Token faltante');
    return res.status(400).json({ error: 'Token es requerido' });
  }

  try {
    // Desencriptar los datos
    const secretPassphrase = "mySecretPassphrase";
    const bytes = CryptoJS.TripleDES.decrypt(dataGame, secretPassphrase);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

    const { puntos, makeGoal, area, token } = decryptedData;

    console.log('Datos desencriptados:', decryptedData);

    if (!token) {
      console.error('Token faltante');
      return res.status(400).json({ error: 'Token es requerido' });
    }

    if (puntos === undefined || makeGoal === undefined || area === undefined) {
      console.error('Datos faltantes');
      return res.status(400).json({ error: 'Todos los datos son requeridos' });
    }

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

    // Calcular puntos
    let calculatedPoints = 0;
    if (makeGoal) {
      const scoreFactor = 2;
      const goalFactor = 3;
      const areaFactor = Math.floor(area / 2);
      calculatedPoints =  (scoreFactor * goalFactor * areaFactor) + puntos;
    }

    const totalScore = sessionData.d.totalScore || 0;
    const newTotalScore = totalScore + calculatedPoints;

    console.log(`total score nuevo: ${newTotalScore}`);

    // Guardar el totalScore y el contador de tiros en Redis
    await rs.set({
      app: rsApp,
      token: token,
      d: {
        ...sessionData.d,
        totalScore: newTotalScore,
        throwCount: nextThrow
      }
    });

    console.log('Total de puntos:', newTotalScore);
    res.json({ message: 'Tiro almacenado en Redis', totalScore: newTotalScore });
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});





app.post('/save-score', async (req, res) => {
  const { token, totalScore } = req.body;

  console.log('total score a guardar:', totalScore);

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

    // Guardar los datos en la base de datos MySQL
    const { cedula, nombre } = sessionData.d;
    
    await User.upsert({ cedula, nombre, totalScore });

    res.json({ message: 'Datos guardados en MySQL', totalScore });
  } catch (err) {
    console.error('Error al guardar en MySQL:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});


// metodo para obtener los 10 mejores puntajes de la base de datos solo mostrara el nombre y el puntaje
app.get('/get-best-scores', async (req, res) => {
  try {
    const scores = await User.findAll({
      attributes: ['nombre', 'totalScore'],
      order: [['totalScore', 'DESC']],
      limit: 10
    });

    res.json(scores);
  } catch (err) {
    console.error('Error al obtener los puntajes:', err);
    res.status(500).json({ error: 'Error al obtener los puntajes' });
  }
});
