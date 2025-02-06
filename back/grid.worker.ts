import { resolveBoundaryCollision, resolveParticleCollision } from "./collision.ts";
import type { Particle } from "./particle.ts";
import type { CollisionResult } from "./collision.ts";

const worker = self as unknown as Worker;

// Constantes estáticas (evitan recrearlas en cada mensaje)
const neighborOffsets = [{ dx: 1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }];

worker.onmessage = (e) => {
  const { buffer, count, width, height, cellSize, restitution, workerIndex, workerCount } = e.data;
  const data = new Float32Array(buffer);

  // Pre-cálculo de la grilla
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cellCount = cols * rows;
  const grid: number[][] = new Array(cellCount);
  for (let i = 0; i < cellCount; i++) grid[i] = [];
  
  // Asignar índices de partículas a las celdas sin recrear objetos
  for (let i = 0; i < count; i++) {
    const base = i * 7;
    // Se acceden directamente las coordenadas en lugar de crear un objeto completo
    const x = data[base + 1];
    const y = data[base + 2];
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    if (cellX < 0 || cellX >= cols || cellY < 0 || cellY >= rows) continue;
    const idx = cellX + cellY * cols;
    grid[idx].push(i); // almacenar el índice
  }
  
  const changes: CollisionResult[] = [];
  const checkedPairs = new Set<string>();
  
  // Función inline para acceder a propiedades de la partícula sin crear objeto
  function getParticleProps(i: number): Particle {
    const base = i * 7;
    return {
      id: data[base],
      x: data[base + 1],
      y: data[base + 2],
      vx: data[base + 3],
      vy: data[base + 4],
      mass: data[base + 5],
      radius: data[base + 6],
      ax: 0,
      ay: 0,
    };
  }
  
  // Procesar colisiones en cada celda y vecinos
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = col + row * cols;
      if (idx % workerCount !== workerIndex) continue;
      const indices = grid[idx];
      
      // Colisiones internas en la celda
      for (let i = 0; i < indices.length; i++) {
        const pIndex1 = indices[i];
        const p1 = getParticleProps(pIndex1);
        for (let j = i + 1; j < indices.length; j++) {
          const pIndex2 = indices[j];
          const p2 = getParticleProps(pIndex2);
          const pairKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
          if (!checkedPairs.has(pairKey)) {
            checkedPairs.add(pairKey);
            changes.push(...resolveParticleCollision(p1, p2, restitution));
          }
        }
      }
      
      // Colisiones con celdas vecinas
      for (const { dx, dy } of neighborOffsets) {
        const nCol = col + dx;
        const nRow = row + dy;
        if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) continue;
        const neighborIndices = grid[nCol + nRow * cols];
        for (let i = 0; i < indices.length; i++) {
          const pIndex1 = indices[i];
          const p1 = getParticleProps(pIndex1);
          for (const pIndex2 of neighborIndices) {
            const p2 = getParticleProps(pIndex2);
            const pairKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
            if (!checkedPairs.has(pairKey)) {
              checkedPairs.add(pairKey);
              changes.push(...resolveParticleCollision(p1, p2, restitution));
            }
          }
        }
      }
    }
  }
  
  // Procesar colisiones con los bordes, recorriendo directamente el buffer
  for (let i = 0; i < count; i++) {
    const p = getParticleProps(i);
    const change = resolveBoundaryCollision(p, width, height, restitution);
    if (Object.keys(change).length > 1) changes.push(change);
  }
  
  worker.postMessage(changes);
};