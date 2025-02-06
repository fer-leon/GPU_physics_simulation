import { Particle } from "./particle.ts";
import { CollisionResult } from "./collision.ts";

// Número de workers a usar
const WORKER_COUNT = 4;
const workerPool: Worker[] = [];
const particleMap = new Map<number, Particle>();

// Usar un SharedArrayBuffer que se actualiza en cada frame
export async function parallelSpatialPartitioning(
    particles: Particle[],
    width: number,
    height: number,
): Promise<void> {
    const restitution = 0.9;
    const maxRadius = Math.max(...particles.map(p => p.radius));
    const cellSize = Math.max(30, maxRadius * 2);

    // Actualizar mapa de partículas
    particleMap.clear();
    particles.forEach(p => particleMap.set(p.id, p));

    // Empaquetar datos en un Float32Array:
    const count = particles.length;
    // Crear un SharedArrayBuffer que contiene count * 7 * 4 bytes (Float32)
    const sab = new SharedArrayBuffer(count * 7 * 4);
    const data = new Float32Array(sab);
    particles.forEach((p, i) => {
        const i7 = i * 7;
        data[i7] = p.id;      // id como número
        data[i7 + 1] = p.x;
        data[i7 + 2] = p.y;
        data[i7 + 3] = p.vx;
        data[i7 + 4] = p.vy;
        data[i7 + 5] = p.mass;
        data[i7 + 6] = p.radius;
    });

    // Inicializar el pool, si aún no está creado.
    if (workerPool.length < WORKER_COUNT) {
        for (let i = workerPool.length; i < WORKER_COUNT; i++) {
            const worker = new Worker(new URL("./grid.worker.ts", import.meta.url).href, { type: "module" });
            workerPool.push(worker);
        }
    }

    const promises: Promise<CollisionResult[]>[] = workerPool.map((worker, idx) => {
        return new Promise(resolve => {
            worker.addEventListener("message", (e) => resolve(e.data), { once: true });
            worker.postMessage({
                buffer: sab,
                count,
                width,
                height,
                cellSize,
                restitution,
                workerIndex: idx,
                workerCount: WORKER_COUNT,
            });
        });
    });

    // Esperar resultados de todos los workers y unirlos
    const collisionChangesArrays = await Promise.all(promises);
    const collisionChanges = collisionChangesArrays.flat();

    // Actualizar partículas con los cambios detectados
    collisionChanges.forEach(change => {
        const p = particleMap.get(change.id)!;
        if (change.x !== undefined) p.x = change.x;
        if (change.y !== undefined) p.y = change.y;
        if (change.vx !== undefined) p.vx = change.vx;
        if (change.vy !== undefined) p.vy = change.vy;
    });
}

// Nueva función para terminar el pool de workers
export function terminateWorkerPool(): void {
  while (workerPool.length > 0) {
    const worker = workerPool.pop();
    worker?.terminate();
  }
}