// collision.ts
import { Particle } from "./particle.ts";

export interface CollisionResult {
  id: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export function resolveParticleCollision(a: Particle, b: Particle, restitution: number): CollisionResult[] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    
    if (distance >= minDist || distance === 0) return [];
    
    const nx = dx / distance;
    const ny = dy / distance;
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    let impulse = -(1 + restitution) * (dvx * nx + dvy * ny);
    impulse /= (1 / a.mass + 1 / b.mass);
    const impulseX = impulse * nx;
    const impulseY = impulse * ny;
    
    // Calcular nuevos valores
    const aVx = a.vx - impulseX / a.mass;
    const aVy = a.vy - impulseY / a.mass;
    const bVx = b.vx + impulseX / b.mass;
    const bVy = b.vy + impulseY / b.mass;
    
    // Separación de partículas
    const overlap = (minDist - distance) / 2;
    const aX = a.x - nx * overlap;
    const aY = a.y - ny * overlap;
    const bX = b.x + nx * overlap;
    const bY = b.y + ny * overlap;
    
    return [
        { id: a.id, x: aX, y: aY, vx: aVx, vy: aVy },
        { id: b.id, x: bX, y: bY, vx: bVx, vy: bVy },
    ];
}

export function resolveBoundaryCollision(particle: Particle, width: number, height: number, restitution: number): CollisionResult {
    const result: CollisionResult = { id: particle.id };
    
    if (particle.x + particle.radius > width) {
        result.x = width - particle.radius;
        result.vx = -Math.abs(particle.vx) * restitution;
    }
    if (particle.x - particle.radius < 0) {
        result.x = particle.radius;
        result.vx = Math.abs(particle.vx) * restitution;
    }
    if (particle.y + particle.radius > height) {
        result.y = height - particle.radius;
        result.vy = -Math.abs(particle.vy) * restitution;
    }
    if (particle.y - particle.radius < 0) {
        result.y = particle.radius;
        result.vy = Math.abs(particle.vy) * restitution;
    }
    
    return result;
}