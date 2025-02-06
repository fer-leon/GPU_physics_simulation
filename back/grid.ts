import { Particle } from "./particle.ts";
import { resolveBoundaryCollision, resolveParticleCollision } from "./collision.ts";

export function spatialPartitioning(
    particles: Particle[],
    width: number,
    height: number,
): void {
    const restitution = 0.9;
    const maxRadius = Math.max(...particles.map(p => p.radius));
    const cellSize = Math.max(60, maxRadius * 3);
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
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const idx = cellX + cellY * cols;
        if (idx < grid.length) grid[idx].push(p);
    }
    

    // 2. Detección de colisiones optimizada utilizando vecinos reales
    const neighborOffsets = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = col + row * cols;
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
            
            // B. Colisiones con celdas vecinas
            for (const offset of neighborOffsets) {
                const nCol = col + offset.dx;
                const nRow = row + offset.dy;
                if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) continue;
                const neighborIdx = nCol + nRow * cols;
                const neighbor = grid[neighborIdx];
                if (neighbor.length === 0) continue;
                
                for (const p1 of cell) {
                    for (const p2 of neighbor) {
                        resolveParticleCollision(p1, p2, restitution);
                    }
                }
            }
        }
    }

    // 3. Limpieza eficiente (reutiliza arrays)
    for (const cell of grid) cell.length = 0;
}