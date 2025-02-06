import { Particle } from "./particle.ts";
import { resolveBoundaryCollision, resolveParticleCollision } from "./collision.ts";

export function spatialPartitioning(
    particles: Particle[],
    width: number,
    height: number,
): void {
    const restitution = 0.9;
    const cellSize = 60; // Ajustado para ~2x el radio máximo (15px * 2 = 30 → cellSize=60)
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const grid: Particle[][] = new Array(cols * rows);
    
    // 1. Inicializar grid y resolver bordes
    for (let i = 0; i < grid.length; i++) grid[i] = [];
    for (const p of particles) {
        // Optimización: Variables locales para accesos frecuentes
        const x = p.x, y = p.y, r = p.radius;
        if (x - r < 0 || x + r > width || y - r < 0 || y + r > height) {
            resolveBoundaryCollision(p, width, height, restitution);
        }
        const cellX = (x / cellSize) | 0; // Bitwise floor
        const cellY = (y / cellSize) | 0;
        const idx = cellX + cellY * cols;
        if (idx < grid.length) grid[idx].push(p);
    }

    // 2. Detección de colisiones optimizada
    const collidableCells = [-cols -1, -cols, -cols +1, -1, 0, 1]; // Vecinos relevantes
    for (let idx = 0; idx < grid.length; idx++) {
        const cell = grid[idx];
        if (cell.length === 0) continue;

        // A. Colisiones dentro de la misma celda (pares únicos)
        for (let i = 0; i < cell.length; i++) {
            const p1 = cell[i];
            for (let j = i + 1; j < cell.length; j++) {
                const p2 = cell[j];
                resolveParticleCollision(p1, p2, restitution);
            }
        }

        // B. Colisiones con celdas vecinas (solo mitad de las combinaciones)
        for (const offset of collidableCells) {
            const neighborIdx = idx + offset;
            if (neighborIdx <= idx || neighborIdx >= grid.length) continue; // Evita duplicados
            const neighbor = grid[neighborIdx];
            if (neighbor.length === 0) continue;

            for (const p1 of cell) {
                for (const p2 of neighbor) {
                    resolveParticleCollision(p1, p2, restitution);
                }
            }
        }
    }

    // 3. Limpieza eficiente (reutiliza arrays)
    for (const cell of grid) cell.length = 0;
}