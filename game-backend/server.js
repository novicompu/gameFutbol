require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const redisClient = require('./config/redisClient');
const Score = require('../models/Score');
const sequelize = require('./config/sequelize');
const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/submit-throw', async (req, res) => {
  const { cedula, tiro, puntos } = req.body;

  if (!cedula || tiro === undefined || puntos === undefined) {
    console.error('Datos faltantes');
    return res.status(400).send('Todos los datos son requeridos');
  }

  const key = `throws:${cedula}`;

  try {
    await redisClient.hSet(key, `throw${tiro}`, puntos);
    console.log(`Tiro almacenado en Redis: cedula=${cedula}, tiro=${tiro}, puntos=${puntos}`);
    res.send('Tiro almacenado en Redis');
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).send('Error al almacenar los datos');
  }
});

app.post('/submit-score', async (req, res) => {
  const { cedula, nombre } = req.body;

  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).send('Cédula y nombre son requeridos');
  }

  const key = `throws:${cedula}`;

  try {
    const throws = await redisClient.hGetAll(key);
    const score = Object.values(throws).reduce((acc, val) => acc + parseInt(val), 0);

    const finalScore = await Score.create({ cedula, nombre, score });

    console.log(`Score final guardado en MySQL: ${finalScore}`);
    await redisClient.del(key);
    res.send('Score final recibido y guardado en MySQL');
  } catch (err) {
    console.error('Error al guardar los datos:', err);
    res.status(500).send('Error al guardar los datos');
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




// codigo para redis manejo de calculo de tiro
app.post('/calculate-score', async (req, res) => {
  const { tiro, puntos, makeGoal, area } = req.body;

  if (tiro === undefined || puntos === undefined || makeGoal === undefined || area === undefined) {
    console.error('Datos faltantes');
    return res.status(400).send('Todos los datos son requeridos');
  }

  const key = `throws:${area}`;

  try {
    await redisClient.hSet(key, `throw${tiro}`, puntos);
    console.log(`Tiro almacenado en Redis: tiro=${tiro}, puntos=${puntos}, makeGoal=${makeGoal}, area=${area}`);

    const throws = await redisClient.hGetAll(key);
    const totalScore = Object.values(throws).reduce((acc, val) => acc + parseInt(val), 0);

    res.json({ message: 'Tiro almacenado en Redis', totalScore: totalScore });
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).send('Error al almacenar los datos');
  }
});



