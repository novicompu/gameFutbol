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
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
});

module.exports = Score;
