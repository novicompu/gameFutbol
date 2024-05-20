const { DataTypes } = require('sequelize');
const sequelize = require('../game-backend/config/sequelize');

const Score = sequelize.define('Score', {
  cedula: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  }
});

module.exports = Score;
