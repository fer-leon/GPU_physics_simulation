import { Particle } from "./particle.ts";
import { resolveBoundaryCollision, resolveParticleCollision } from "./collision.ts";

// Module-level cache for grid reuse.
let cachedGrid: Particle[][] | null = null;
let cachedCols = 0;
let cachedRows = 0;

export function spatialPartitioning(
    particles: Particle[],
    width: number,
    height: number,
): void {
    const restitution = 0.9;
    // Use a for-loop to compute maxRadius (avoids creating an interim array).
    let maxRadius = 0;
    for (const p of particles) {
        if (p.radius > maxRadius) {
            maxRadius = p.radius;
        }
    }
    const cellSize = Math.max(60, maxRadius * 3);
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    
    let grid: Particle[][];
    // Reuse cached grid if available and dimensions match.
    if (cachedGrid && cachedCols === cols && cachedRows === rows) {
        grid = cachedGrid;
        for (let i = 0; i < grid.length; i++) grid[i].length = 0;
    } else {
        grid = new Array(cols * rows);
        for (let i = 0; i < grid.length; i++) grid[i] = [];
        cachedGrid = grid;
        cachedCols = cols;
        cachedRows = rows;
    }
    
    // 1. Initialize grid and resolve boundary collisions
    for (const p of particles) {
        const { x, y, radius: r } = p;
        if (x - r < 0 || x + r > width || y - r < 0 || y + r > height) {
            resolveBoundaryCollision(p, width, height, restitution);
        }
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const idx = cellX + cellY * cols;
        if (idx < grid.length) grid[idx].push(p);
    }
    
    // 2. Collision detection using neighbor cells
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
            
            // A. Collisions within the cell
            for (let i = 0; i < cell.length; i++) {
                const p1 = cell[i];
                for (let j = i + 1; j < cell.length; j++) {
                    const p2 = cell[j];
                    resolveParticleCollision(p1, p2, restitution);
                }
            }
            
            // B. Collisions with neighboring cells
            for (const { dx, dy } of neighborOffsets) {
                const nCol = col + dx;
                const nRow = row + dy;
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
}