const fs = require('fs');
const path = require('path');
const actividadPath = path.join(__dirname, 'actividad.json');

// Inicializa archivo si no existe
if (!fs.existsSync(actividadPath)) {
  fs.writeFileSync(actividadPath, JSON.stringify({}));
}

function registrarActividad(userId) {
  const data = JSON.parse(fs.readFileSync(actividadPath, 'utf-8'));
  data[userId] = (data[userId] || 0) + 1;
  fs.writeFileSync(actividadPath, JSON.stringify(data, null, 2));
}

function obtenerActividad() {
  return JSON.parse(fs.readFileSync(actividadPath, 'utf-8'));
}

module.exports = { registrarActividad, obtenerActividad };
