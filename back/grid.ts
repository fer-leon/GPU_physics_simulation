import { Particle } from "./particle.ts";
import { resolveParticleCollision, resolveBoundaryCollision } from "./collision.ts";

export function spatialPartitioning(particles: Particle[], width: number, height: number): void {
    const restitution = 0.9;
    const cellSize = 50;

    // Handle boundary collisions using provided width and height
    for (const particle of particles) {
        resolveBoundaryCollision(particle, width, height, restitution);
    }

    const grid = new Map<string, Particle[]>();

    // Partition space
    for (const p of particles) {
        const cellX = Math.floor(p.x / cellSize);
        const cellY = Math.floor(p.y / cellSize);
        const key = `${cellX},${cellY}`;
        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key)!.push(p);
    }

    // Check collisions in neighboring cells
    for (const [key, cellParticles] of grid) {
        const [cellX, cellY] = key.split(",").map(Number);
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                const neighborX = cellX + offsetX;
                const neighborY = cellY + offsetY;
                const neighborKey = `${neighborX},${neighborY}`;
                if (neighborKey < key) continue;
                const neighborParticles = grid.get(neighborKey);
                if (!neighborParticles) continue;
                for (let i = 0; i < cellParticles.length; i++) {
                    const startIndex = (neighborKey === key) ? i + 1 : 0;
                    for (let j = startIndex; j < neighborParticles.length; j++) {
                        const a = cellParticles[i];
                        const b = neighborParticles[j];
                        if (a === b) continue;
                        resolveParticleCollision(a, b, restitution);
                    }
                }
            }
        }
    }
}