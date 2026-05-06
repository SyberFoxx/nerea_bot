import fs from 'fs';
import path from 'path';

const actividadPath = path.join(__dirname, 'actividad.json');

if (!fs.existsSync(actividadPath)) {
  fs.writeFileSync(actividadPath, JSON.stringify({}));
}

export function registrarActividad(userId: string): void {
  const data: Record<string, number> = JSON.parse(fs.readFileSync(actividadPath, 'utf-8'));
  data[userId] = (data[userId] ?? 0) + 1;
  fs.writeFileSync(actividadPath, JSON.stringify(data, null, 2));
}

export function obtenerActividad(): Record<string, number> {
  return JSON.parse(fs.readFileSync(actividadPath, 'utf-8'));
}
