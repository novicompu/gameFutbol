const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/submit', (req, res) => {
    console.log('Cuerpo de la solicitud:', req.body);
    const { cedula, Nombre } = req.body;
    console.log(`Cédula: ${cedula}, Nombre: ${Nombre}`);
    res.send('Datos recibidos');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});

