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

// realizar-login
app.post('/submit-login', async (req, res) => {
  const { cedula, nombre, currentPath } = req.body;
  let marca = 'payjoy';


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
  const { cedula, nombre, currentPath } = req.body;
  let marca;

  // casos de currentPath
  if (process.env.epson === currentPath) {
    marca = 'epson';
  } else if (process.env.honor === currentPath) {
    marca = 'honor';
  } else if (process.env.pacifico === currentPath) {
    marca = 'pacifico';
  } else if (process.env.payjoy === currentPath) {
    marca = 'payjoy';
  } 

  console.log('Datos recibidos:', currentPath);

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

        console.log('Sesión creada:', session.token);
        return res.status(200).json({ message: 'Credenciales correctas', token: session.token });
      } else {
        console.error('Nombre incorrecto');
        return res.status(400).json({ error: 'Credenciales incorrectas' });
      }
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
  const { cedula, nombre, telefono, codigoFactura, currentPath } = req.body;
  
  let marca; 

  // Determinar el valor de `marca` basado en `currentPath`

  if (currentPath === process.env.epson) {
    marca = 'epson';
  } else if (currentPath === process.env.honor) {
    marca = 'honor';
  } else if (currentPath === process.env.pacifico) {
    marca = 'pacifico';
  } else if (currentPath === process.env.payjoy) {
    marca = 'payjoy';
  }



  

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
          // const hasValidProduct = invoiceData.items.some(item => item.product.code.startsWith('1CHON'));
          // if (hasValidProduct) {
          //     return invoiceData;
          // } else {
          //     return { error: 'Factura inválida: ningún producto con el código "1CHON"' };
          // }
          return invoiceData;
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



app.listen(port, async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
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

  try {
    const secretPassphrase = process.env.SECRET_PASSPHRASE;
    const bytes = CryptoJS.TripleDES.decrypt(dataGame, secretPassphrase);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    
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
    res.status(500).json({ error: 'Error al almacenar los datos' });
  }
});



// guardar-score
app.post('/save-score', async (req, res) => {
  const { token, totalScore } = req.body;
  let { currentPath } = req.body;

  let marca;
  if (process.env.epson === currentPath) {
    marca = 'epson';
  } else if (process.env.honor === currentPath) {
    marca = 'honor';
  } else if (process.env.pacifico === currentPath) {
    marca = 'pacifico';
  } else if (process.env.payjoy === currentPath) {
    marca = 'payjoy';
  } 

  
  //let marca = currentPath;

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
    console.log('Datos recibidos:', marca);
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
  let { marca } = req.body;

 
  console.log('Datos recibidos:', marca);
  if (process.env.epson === marca) {
    marca = 'epson';
  } else if (process.env.honor === marca) {
    marca = 'honor';
  } else if (process.env.pacifico === marca) {
    marca = 'pacifico';
  } else if (process.env.payjoy === marca) {
    marca = 'payjoy';
  } 

  console.log('Datos marcaaa:', marca);
  if (!marca) {
    return res.status(400).json({ error: 'Marca es requerida' , marca});
  }

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

