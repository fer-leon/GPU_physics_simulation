import { Particle } from "./particle.ts";
import { resolveParticleCollision, resolveBoundaryCollision } from "./collision.ts";

export function spatialPartitioning(particles: Particle[], width: number, height: number): void {
    const restitution = 0.9;
    const cellSize = 50;

    // Resolver colisiones con los límites
    for (const particle of particles) {
        resolveBoundaryCollision(particle, width, height, restitution);
    }

    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const grid: Particle[][] = new Array(columns * rows).fill(null).map(() => []);

    // Particionar el espacio en la grilla sin strings
    for (const p of particles) {
        const cellX = Math.floor(p.x / cellSize);
        const cellY = Math.floor(p.y / cellSize);
        const index = cellX + cellY * columns;
        grid[index].push(p);
    }

    // Chequear colisiones en las celdas y sus vecinas
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            const index = x + y * columns;
            const cellParticles = grid[index];
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                const ny = y + offsetY;
                if (ny < 0 || ny >= rows) continue;
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const nx = x + offsetX;
                    if (nx < 0 || nx >= columns) continue;
                    const nIndex = nx + ny * columns;
                    if (nIndex < index) continue; // evita revisar pares duplicados
                    const neighborParticles = grid[nIndex];
                    for (let i = 0; i < cellParticles.length; i++) {
                        const startIndex = (nIndex === index) ? i + 1 : 0;
                        for (let j = startIndex; j < neighborParticles.length; j++) {
                            resolveParticleCollision(cellParticles[i], neighborParticles[j], restitution);
                        }
                    }
                }
            }
        }
    }
}