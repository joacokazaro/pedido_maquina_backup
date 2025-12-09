import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('./data/data.json');

export function readDB() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo DB:", err);
    return null;
  }
}

export function writeDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error escribiendo DB:", err);
    return false;
  }
}
