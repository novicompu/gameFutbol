require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const redisClient = require('./config/redisClient');
const Score = require('../models/Score');
const sequelize = require('./config/sequelize');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://127.0.0.1:5500'
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/submit-throw', async (req, res) => {
  const { cedula, tiro, puntos } = req.body;

  if (!cedula || tiro === undefined || puntos === undefined) {
    console.error('Datos faltantes');
    return res.status(400).json({ error: 'Todos los datos son requeridos' });
  }

  const key = `throws:${cedula}`;

  try {
    await redisClient.hSet(key, `throw${tiro}`, puntos);
    console.log(`Tiro almacenado en Redis: cedula=${cedula}, tiro=${tiro}, puntos=${puntos}`);
    res.json({ message: 'Tiro almacenado en Redis' });
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});

app.post('/submit-score', async (req, res) => {
  const { cedula, nombre } = req.body;

  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
  }

  try {
    console.log(`Datos recibidos: cédula=${cedula}, nombre=${nombre}`);
    res.json({ message: 'Datos recibidos correctamente', cedula, nombre });
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al procesar los datos' });
  }
});
// app.post('/submit-score', async (req, res) => {
//   const { cedula, nombre } = req.body;

//   if (!cedula || !nombre) {
//     console.error('Cédula o nombre faltantes');
//     return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
//   }

//   try {
//     console.log(`Datos recibidos: cédula=${cedula}, nombre=${nombre}`);
    
//     // Guarda los datos en la base de datos
//     const score = await Score.create({ cedula, nombre });

//     res.json({ message: 'Datos recibidos correctamente', cedula: score.cedula, nombre: score.nombre });
//   } catch (err) {
//     console.error('Error al procesar los datos:', err);
//     res.status(500).json({ error: 'Error al procesar los datos' });
//   }
// });


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

// Código para Redis manejo de cálculo de tiro
app.post('/calculate-score', async (req, res) => {
  const { tiro, puntos, makeGoal, area } = req.body;

  if (tiro === undefined || puntos === undefined || makeGoal === undefined || area === undefined) {
    console.error('Datos faltantes');
    return res.status(400).json({ error: 'Todos los datos son requeridos' });
  }

  const throwsKey = `throws:${area}`;
  const totalScoreKey = `totalScore`;

  try {
    await redisClient.hSet(throwsKey, `throw${tiro}`, puntos.toString());
    console.log(`Tiro almacenado en Redis: tiro=${tiro}, puntos=${puntos}, makeGoal=${makeGoal}, area=${area}`);
    console.log('si llego aqui');

    const throws = await redisClient.hGetAll(throwsKey);
    console.log('Tiros almacenados:', throws);

    // Calcular el puntaje total para este área específica
    const totalAreaScore = Object.values(throws).reduce((acc, val) => {
      const intVal = parseInt(val);
      if (isNaN(intVal)) {
        console.error(`Valor no es un entero: ${val}`);
        return acc;
      }
      return acc + intVal;
    }, 0);

    // Obtener el totalScore actual
    let totalScore = 0;
    const existingTotalScore = await redisClient.get(totalScoreKey);
    if (existingTotalScore !== null) {
      totalScore = parseInt(existingTotalScore);
    }

    const scoreFactor = 2; // Factor base reducido
    const goalFactor = makeGoal ? 3 : 1; // Factor si se hizo gol reducido
    const areaFactor = Math.floor(area / 2); // Factor del área reducido

    // Limitar puntos para evitar valores excesivos
    const calculatedPoints = Math.floor(puntos * scoreFactor * goalFactor * areaFactor);

    // Calcular el nuevo totalScore
    totalScore += calculatedPoints;

    // Almacenar el totalScore actualizado en Redis
    await redisClient.set(totalScoreKey, totalScore.toString());
    console.log('totalScore almacenado:', totalScore);

    res.json({ message: 'Tiro almacenado en Redis', totalScore: totalScore });
  } catch (err) {
    console.error('Error al almacenar en Redis:', err);
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});


