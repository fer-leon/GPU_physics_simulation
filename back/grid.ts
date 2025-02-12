import { Particle } from "./particle.ts";
import { resolveParticleCollision } from "./collision.ts";

// Simplified CPU implementation for testing purposes
export function parallelSpatialPartitioning(
    particles: Particle[],
    _width: number,
    _height: number,
): void {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const changes = resolveParticleCollision(particles[i], particles[j], 0.9);
            for (const change of changes) {
                const p = particles.find(p => p.id === change.id)!;
                if (change.x !== undefined) p.x = change.x;
                if (change.y !== undefined) p.y = change.y;
                if (change.vx !== undefined) p.vx = change.vx;
                if (change.vy !== undefined) p.vy = change.vy;
            }
        }
    }
}