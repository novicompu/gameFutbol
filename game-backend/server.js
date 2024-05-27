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

app.use('/', express.static('../public'));

app.post('/submit-login', async (req, res) => {
  const { cedula, nombre } = req.body;
  const totalScore = 0;

  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
  }

  try {
    // Crear una nueva sesión en Redis
    const session = await rs.create({
      app: rsApp,
      id: cedula,
      ip: req.ip,
      ttl: 3600,
      d: { nombre, cedula, totalScore }
    });
    // Verificar si la cédula ya existe en la base de datos
    const usuarioExistente = await User.findOne({ where: { cedula } });

    if (usuarioExistente) {
      console.log(`La cédula ${cedula} ya existe.`);
      // Return 200 (OK) instead of 400 (Bad Request) y devolver el token de la sesión
      return res.status(200).json({ message: 'Usuario ya registrado', token: session.token });
    }

    

    console.log('Sesión creada:', session.token);
    console.log(`Datos recibidos: cédula=${cedula}, nombre=${nombre}`);

    // Guardar los datos en la base de datos MySQL
    const nuevoUsuario = await User.create({ cedula, nombre, totalScore });

    // Devolver el token de la sesión
    res.json({ message: 'Datos recibidos y guardados correctamente', token: session.token });

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

  if (!dataGame) {
    return res.status(400).json({ error: 'Token es requerido' });
  }

  try {
    const secretPassphrase = "mySecretPassphrase";
    const bytes = CryptoJS.TripleDES.decrypt(dataGame, secretPassphrase);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

    const { puntos, makeGoal, area, token } = decryptedData;
    console.log('Datos desencriptados:', decryptedData);

    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    if (puntos === undefined || makeGoal === undefined || area === undefined) {
      return res.status(400).json({ error: 'Todos los datos son requeridos' });
    }

    const sessionData = await rs.get({
      app: rsApp,
      token: token
    });

    if (!sessionData) {
      return res.status(400).json({ error: 'Token no válido' });
    }

    const areasValidas = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    let calculatedPoints = 0;

    if (areasValidas.includes(area)) {
      if (makeGoal) {
        const scoreFactor = 2;
        const goalFactor = 3;
        const areaFactor = Math.floor(area / 2);
        calculatedPoints = (scoreFactor * goalFactor * areaFactor) + puntos;
      }
    }

    const totalScore = sessionData.d.totalScore || 0;
    const newTotalScore = totalScore + calculatedPoints;

    await rs.set({
      app: rsApp,
      token: token,
      d: {
        ...sessionData.d,
        totalScore: newTotalScore,
        throwCount: sessionData.d.throwCount + 1
      }
    });

    res.json({ message: 'Tiro almacenado en Redis', totalScore: newTotalScore });
  } catch (err) {
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});






// app.post('/save-score', async (req, res) => {
//   const { token, totalScore } = req.body;

//   console.log('total score a guardar:', totalScore);

//   if (!token) {
//     console.error('Token faltante');
//     return res.status(400).json({ error: 'Token es requerido' });
//   }

//   try {
//     // Recuperar session token
//     const sessionData = await rs.get({
//       app: rsApp,
//       token: token
//     });

//     if (!sessionData) {
//       console.error('Token no válido');
//       return res.status(400).json({ error: 'Token no válido' });
//     }

//     console.log('Datos de la sesión:', sessionData);

//     // Guardar los datos en la base de datos MySQL
//     const { cedula, nombre } = sessionData.d;
    
//     // Recuperar el usuario actual para verificar el totalScore
//     const usuario = await User.findOne({ where: { cedula } });

//     if (usuario) {
//       if (totalScore > usuario.totalScore) {
//         await User.update({ totalScore }, { where: { cedula } });
//       } else {
//         console.log(`Total score no actualizado, el nuevo score ${totalScore} no es mayor que el actual ${usuario.totalScore}`);
//       }
//     } else {
//       console.error('Usuario no encontrado');
//       return res.status(404).json({ error: 'Usuario no encontrado' });
//     }

//     // Eliminar la sesión de Redis
//     await rs.kill({
//       app: rsApp,
//       token: token
//     });

//     res.json({ message: 'Datos guardados', totalScore });
//   } catch (err) {
//     console.error('Error al guardar en MySQL:', err);
//     res.status(500).json({ error: 'Error al guardar los datos' });
//   }
// });



// metodo para obtener los 10 mejores puntajes de la base de datos solo mostrara el nombre y el puntaje

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
    
    // Recuperar el usuario actual para verificar el totalScore
    const usuario = await User.findOne({ where: { cedula } });

    if (usuario) {
      let mejorScore = usuario.totalScore;

      if (totalScore > usuario.totalScore) {
        await User.update({ totalScore }, { where: { cedula } });
        mejorScore = totalScore; // Actualizamos mejorScore al nuevo totalScore
      } else {
        console.log(`Total score no actualizado, el nuevo score ${totalScore} no es mayor que el actual ${usuario.totalScore}`);
      }

      // Eliminar la sesión de Redis
      await rs.kill({
        app: rsApp,
        token: token
      });

      res.json({ message: 'Datos guardados', totalScore, mejorScore });
    } else {
      console.error('Usuario no encontrado');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

  } catch (err) {
    console.error('Error al guardar en MySQL:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});


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




