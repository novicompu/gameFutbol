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
const e = require('express');

// Configuración de RedisSessions.
// REDIS_HOST admite tanto el hostname suelto como una URL redis:// completa.
const { resolveConnection } = require('./config/connection');

const redisCfg = resolveConnection(process.env.REDIS_HOST, {
  host: '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD
});

if (redisCfg.fromUrl) {
  console.log(`Redis: configuracion tomada de la URL en REDIS_HOST (host ${redisCfg.host}:${redisCfg.port})`);
}

const rs = new RedisSessions({
  host: redisCfg.host,
  port: redisCfg.port,
  options: redisCfg.password ? { password: redisCfg.password } : {}
});

// Sin este manejador un fallo de conexion emite un 'error' sin capturar y
// tumba el proceso entero con un stack de Node, en vez de un mensaje util.
// `redis` es privada en los tipos de la libreria, de ahi la comprobacion.
if (rs.redis && typeof rs.redis.on === 'function') {
  rs.redis.on('error', (err) => {
    console.error(`Error de conexion con Redis (${redisCfg.host}:${redisCfg.port}):`, err.message);
  });
}

const rsApp = "myapp";

// Un solo dominio => una sola marca. Antes se deducia del host que enviaba
// el front (currentPath); ahora es fija y viene de la configuracion.
const MARCA = process.env.MARCA || 'diagamer';

// Con nginx haciendo proxy de /api el origen es el mismo, pero se deja
// configurable por si el front se sirve desde otro host.
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));

// Necesario para que req.ip refleje la IP real detras del proxy
app.set('trust proxy', true);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// realizar-login
app.post('/submit-login', async (req, res) => {
  const { cedula, nombre } = req.body;
  const marca = MARCA;


  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
  }

  try {
    // Verificar si la cédula ya existe en la base de datos
    const usuarioExistente = await User.findOne({ where: { cedula, marca } });  

    if (usuarioExistente) {
      // Validar las credenciales
      if (usuarioExistente.nombre === nombre) {
        // Eliminar todas las sesiones activas del usuario
        await rs.killsoid({
          app: rsApp,
          id: cedula
        });

        // Crear una nueva sesión en Redis con el `totalScore` restablecido
        const session = await rs.create({
          app: rsApp,
          id: cedula,
          ip: req.ip,
          ttl: 3600,
          d: { nombre, cedula, totalScore: 0 }  // Restablecemos el totalScore a 0
        });

        return res.status(200).json({ message: 'Credenciales correctas', token: session.token });
      } else {
        console.error('Nombre incorrecto');
        return res.status(400).json({ error: 'Credenciales incorrectas' });
      }
    } else {
      // Crear una nueva sesión en Redis
      const session = await rs.create({
        app: rsApp,
        id: cedula,
        ip: req.ip,
        ttl: 3600,
        d: { nombre, cedula, totalScore: 0 }
      });

      


      // Guardar los datos en la base de datos MySQL
      const nuevoUsuario = await User.create({
        cedula,
        nombre,
        totalScore: 0,
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
        marca: marca,
        telefono: '',
        codigoFactura: ''
      });
      // Devolver el token de la sesión
      res.json({ message: 'Usuario registrado correctamente', token: session.token });
    }

  } catch (err) {
    console.error('Error al procesar los datos:', err);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al procesar los datos' });
    }
  }
});

// realizar-login marcas 
app.post('/submit-loginMarcas', async (req, res) => {
  const { cedula, nombre } = req.body;
  const marca = MARCA;

  if (!cedula || !nombre) {
    console.error('Cédula o nombre faltantes');
    return res.status(400).json({ error: 'Cédula y nombre son requeridos' });
  }

  try {
    // Verificar si la cédula ya existe en la base de datos
    const usuarioExistente = await User.findOne({ where: { cedula, marca } });

    if (usuarioExistente) {
      // Validar las credenciales
      if (usuarioExistente.nombre === nombre) {
        // Eliminar todas las sesiones activas del usuario
        await rs.killsoid({
          app: rsApp,
          id: cedula
        });

        // Crear una nueva sesión en Redis con el `totalScore` restablecido
        const session = await rs.create({
          app: rsApp,
          id: cedula,
          ip: req.ip,
          ttl: 3600,
          d: { nombre, cedula, totalScore: 0 }  // Restablecemos el totalScore a 0
        });

        return res.status(200).json({ message: 'Credenciales correctas', token: session.token });
      } else {
        console.error('Nombre incorrecto');
        return res.status(400).json({ error: 'Credenciales incorrectas' });
      }
    } else {
      // Sin esta respuesta la peticion quedaba colgada para todo usuario
      // que aun no se ha registrado en esta marca.
      console.error('Usuario no registrado');
      return res.status(400).json({ error: 'Usuario no registrado. Regístrate primero.' });
    }

  } catch (err) {
    console.error('Error al procesar los datos:', err);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al procesar los datos' });
    }
  }
});


// solo registro de usuario
app.post('/submit-registration', async (req, res) => {
  const { cedula, nombre, telefono, codigoFactura } = req.body;

  const marca = MARCA;




  

  if (!cedula || !nombre || !telefono || !codigoFactura) {
      console.error('Datos faltantes');
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  try {
    let invoiceData = {};
    
    
    // invoiceData = await validarFactura(codigoFactura, marca);

    // if (invoiceData.error !== undefined) {
    //     console.error('Factura no válida:', invoiceData.error);
    //     return res.status(400).json({ error: 'Datos de factura inválido' });
    // }
   

    // Verificar si la cédula ya existe en la base de datos
    const usuarioExistente = await User.findOne({ where: { cedula, marca } });

    if (usuarioExistente) {
        console.error('Usuario ya registrado');
        return res.status(400).json({ error: 'Usuario ya registrado' });
    } else {

        // eliminar caracteres no numéricos del codigo de factura

        
        const codigoFacturaNumeros = codigoFactura.replace(/\D/g, '');
        // Guardar los datos en la base de datos MySQL
        const nuevoUsuario = await User.create({
            cedula,
            nombre,
            telefono,
            codigoFactura: codigoFacturaNumeros,
            totalScore: 0,
            fecha_creacion: new Date(),
            fecha_actualizacion: new Date(),
            marca: marca
        });

        // Devolver un mensaje de éxito
        res.json({ message: 'Usuario registrado correctamente' });
    }
  } catch (err) {
      console.error('Error al procesar los datos:', err);

      if (!res.headersSent) {
          res.status(500).json({ error: 'Error al procesar los datos' });
      }
  }
});





// funcion para validar factura 
async function validarFactura(codigoFactura, marca) {
  const codigoFacturaNumeros = codigoFactura.replace(/\D/g, '');
  const token = process.env.tokenFacturacion;
  let facturaUrl = `FACEL-${codigoFacturaNumeros}-NVC01`;
  const url = `http://45.77.166.183/api/invoices/bycode/${facturaUrl}?token=${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json'
          },
          signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.status === 404) {
          return { error: 'Factura no encontrada' };
      } else if (response.status >= 500) {
          return { error: 'Error del servidor al validar la factura', status: response.status };
      } else if (!response.ok) {
          return { error: response.statusText };
      }

      const invoiceData = await response.json();

      // Buscar productos cuyo código comience con "1CHON"

      if (marca === 'epson') {
          const hasValidProduct = invoiceData.items.some(item => item.product.code.startsWith('1EEPS'));
          if (hasValidProduct) {
              return invoiceData;
          } else {
              return { error: 'Factura inválida: ningún producto con el código "1EEPS"' };
          }
      } else if (marca === 'honor') {
          const hasValidProduct = invoiceData.items.some(item => item.product.code.startsWith('1CHON'));
          if (hasValidProduct) {
              return invoiceData;
          } else {
              return { error: 'Factura inválida: ningún producto con el código "1CHON"' };
          }
      } else if (marca === 'pacifico') {
        // solo verificamos que la factura exista
        return invoiceData;
      } else if (marca === 'payjoy') {
        // solo verificamos que la factura exista
        return invoiceData;
      }

      
  } catch (error) {
    console.error('Error al validar la factura:', error);
    console.error('URL:', url);
      if (error.name === 'AbortError') {
          return { error: 'Tiempo de espera agotado al validar la factura' };
      } else {
          return { error: 'Error al validar la factura' };
      }
      
  }
}



// Healthcheck para Docker / Dokploy
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', marca: MARCA });
});

app.listen(port, '0.0.0.0', async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log(`Backend escuchando en el puerto ${port} (marca: ${MARCA})`);
  } catch (err) {
    console.error('No se pudo conectar a la base de datos:', err);
  }
});

// calculate-score
app.post('/calculate-score', async (req, res) => {
  const { dataGame } = req.body;

  if (!dataGame) {
    return res.status(400).json({ error: 'Token es requerido' });
  }

  // El descifrado se aisla del resto: si la passphrase del backend no
  // coincide con la del cliente, TripleDES devuelve basura y el JSON.parse
  // lanza. Sin este bloque acababa en el catch general como un 500 mudo.
  let decryptedData;
  try {
    const secretPassphrase = process.env.SECRET_PASSPHRASE;
    const bytes = CryptoJS.TripleDES.decrypt(dataGame, secretPassphrase);
    const plano = bytes.toString(CryptoJS.enc.Utf8);
    if (!plano) {
      throw new Error('el descifrado no produjo texto legible');
    }
    decryptedData = JSON.parse(plano);
  } catch (err) {
    console.error(
      'No se pudo descifrar dataGame. Comprueba que SECRET_PASSPHRASE del ' +
      'backend sea exactamente igual al valor de `xpress` en js/CGame.js ' +
      'del frontend. Detalle:', err.message
    );
    return res.status(400).json({ error: 'Datos de juego ilegibles' });
  }

  try {
    const { puntos, makeGoal, area, token } = decryptedData;

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
      const scoreFactor = 2;
      const goalFactor = 3;
      const areaFactor = area === 0 ? 1 : Math.floor(area / 2); // Asegurar que el área 0 tenga un valor positivo en el cálculo
      if (makeGoal) {
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
    console.error('Error en calculate-score:', err);
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});



// guardar-score
app.post('/save-score', async (req, res) => {
  const { token, totalScore } = req.body;
  const marca = MARCA;

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

    // Guardar los datos en la base de datos MySQL
    const { cedula, nombre } = sessionData.d;
    // Recuperar el usuario actual para verificar el totalScore
    const usuario = await User.findOne({ where: { cedula, marca } });

    if (usuario) {
      let mejorScore = usuario.totalScore;

      if (totalScore > usuario.totalScore) {
        await User.update(
          { totalScore, fecha_actualizacion: new Date() }, 
          { where: { cedula, marca } } // Incluir marca en la condición
        );
        mejorScore = totalScore; // Actualizamos mejorScore al nuevo totalScore
      }

      // Eliminar la sesión de Redis
      await rs.kill({
        app: rsApp,
        token: token
      });

      res.json({ message: 'Datos guardados', totalScore, mejorScore });
    } else {
      // guardar los datos del usuario por primera vez
      await User.create({
        cedula,
        nombre,
        totalScore,
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
        marca
      });

      // Eliminar la sesión de Redis
      await rs.kill({
        app: rsApp,
        token: token
      });

      res.json({ message: 'Datos guardados', totalScore, mejorScore: totalScore });

    }

  } catch (err) {
    console.error('Error al guardar en MySQL:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});



// get-best-scores
app.post('/get-best-scores', async (req, res) => {
  const marca = MARCA;

  try {
    const scores = await User.findAll({
      attributes: ['nombre', 'totalScore'],
      where: { marca },
      order: [['totalScore', 'DESC']],
      limit: 10
    });

    // si no hay puntajes registrados devolver los valores en 0
    if (scores.length === 0) {
      return res.json([
        { nombre: 'Usuario 1', totalScore: 0 }
      ]);
    }
    

    res.json(scores);
  } catch (err) {
    console.error('Error al obtener los puntajes:', err);
    res.status(500).json({ error: 'Error al obtener los puntajes' });
  }
});

