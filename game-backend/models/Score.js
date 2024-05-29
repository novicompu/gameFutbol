const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  cedula: {
    type: DataTypes.STRING,
    allowNull: false,
    
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  totalScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: false
  },
  fecha_actualizacion: {
    type: DataTypes.DATE,
    allowNull: false
  },
  marca: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  codigoFactura: {
    type: DataTypes.STRING,
    allowNull: true,
  },

}, {
  tableName: 'usuarios',
  timestamps: false // Deshabilitar timestamps automáticos
});

module.exports = User;
