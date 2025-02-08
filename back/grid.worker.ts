import { resolveBoundaryCollision, resolveParticleCollision } from "./collision.ts";
import type { Particle } from "./particle.ts";
import type { CollisionResult } from "./collision.ts";

const worker = self as unknown as Worker;

// Pre-allocated reusable objects for collision checks
const p1Data = { id: 0, x: 0, y: 0, vx: 0, vy: 0, mass: 0, radius: 0, ax: 0, ay: 0 };
const p2Data = { id: 0, x: 0, y: 0, vx: 0, vy: 0, mass: 0, radius: 0, ax: 0, ay: 0 };
const neighborOffsets = [{ dx: 1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }];

worker.onmessage = (e) => {
  const { buffer, count, width, height, cellSize, restitution, workerIndex, workerCount } = e.data;
  const data = new Float32Array(buffer);

  // Pre-calculate grid dimensions
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cellCount = cols * rows;
  
  // Use Uint16Array for better memory efficiency with particle indices
  const grid = new Array(cellCount);
  const gridCapacity = 64;
  for (let i = 0; i < cellCount; i++) {
    grid[i] = new Uint16Array(gridCapacity);
    grid[i][0] = 0; // First element stores count
  }
  
  // Assign particles to grid cells
  for (let i = 0; i < count; i++) {
    const base = i * 7;
    const x = data[base + 1];
    const y = data[base + 2];
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    if (cellX < 0 || cellX >= cols || cellY < 0 || cellY >= rows) continue;
    
    const idx = cellX + cellY * cols;
    const cellArray = grid[idx];
    if (cellArray[0] < gridCapacity - 1) {
      cellArray[++cellArray[0]] = i;
    }
  }

  const changes: CollisionResult[] = [];
  const checkedPairs = new Set<string>();
  
  // Process cells in a striped pattern for better load balancing
  for (let stripe = workerIndex; stripe < cols; stripe += workerCount) {
    for (let row = 0; row < rows; row++) {
      const idx = stripe + row * cols;
      const cellArray = grid[idx];
      const cellCount = cellArray[0];
      
      // Process particles in current cell
      for (let i = 1; i <= cellCount; i++) {
        const pIndex1 = cellArray[i];
        readParticleData(data, pIndex1, p1Data);
        
        // Check against other particles in same cell
        for (let j = i + 1; j <= cellCount; j++) {
          const pIndex2 = cellArray[j];
          processCollision(data, pIndex1, pIndex2, p1Data, p2Data, restitution, checkedPairs, changes);
        }
        
        // Check neighboring cells
        for (const { dx, dy } of neighborOffsets) {
          const nCol = stripe + dx;
          const nRow = row + dy;
          if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) continue;
          
          const neighborArray = grid[nCol + nRow * cols];
          const neighborCount = neighborArray[0];
          
          for (let j = 1; j <= neighborCount; j++) {
            const pIndex2 = neighborArray[j];
            processCollision(data, pIndex1, pIndex2, p1Data, p2Data, restitution, checkedPairs, changes);
          }
        }
      }
    }
  }
  
  worker.postMessage(changes);
};

function readParticleData(data: Float32Array, index: number, target: any): void {
  const base = index * 7;
  target.id = data[base];
  target.x = data[base + 1];
  target.y = data[base + 2];
  target.vx = data[base + 3];
  target.vy = data[base + 4];
  target.mass = data[base + 5];
  target.radius = data[base + 6];
}

function processCollision(
  data: Float32Array,
  pIndex1: number,
  pIndex2: number,
  p1: any,
  p2: any,
  restitution: number,
  checkedPairs: Set<string>,
  changes: CollisionResult[]
): void {
  const pairKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
  if (checkedPairs.has(pairKey)) return;
  
  readParticleData(data, pIndex2, p2);
  if (Math.abs(p1.x - p2.x) > p1.radius + p2.radius || 
      Math.abs(p1.y - p2.y) > p1.radius + p2.radius) return;
  
  checkedPairs.add(pairKey);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distSq = dx * dx + dy * dy;
  const minDist = p1.radius + p2.radius;
  
  if (distSq >= minDist * minDist || distSq === 0) return;
  
  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const dvx = p2.vx - p1.vx;
  const dvy = p2.vy - p1.vy;
  let impulse = -(1 + restitution) * (dvx * nx + dvy * ny);
  impulse /= (1 / p1.mass + 1 / p2.mass);
  
  changes.push(
    { 
      id: p1.id,
      x: p1.x - nx * (minDist - dist) * 0.5,
      y: p1.y - ny * (minDist - dist) * 0.5,
      vx: p1.vx - impulse * nx / p1.mass,
      vy: p1.vy - impulse * ny / p1.mass
    },
    {
      id: p2.id,
      x: p2.x + nx * (minDist - dist) * 0.5,
      y: p2.y + ny * (minDist - dist) * 0.5,
      vx: p2.vx + impulse * nx / p2.mass,
      vy: p2.vy + impulse * ny / p2.mass
    }
  );
}