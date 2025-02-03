import { Particle } from "./particle.ts";

export function resolveParticleCollision(a: Particle, b: Particle, restitution: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    
    if (distance < minDist && distance > 0) {
        const nx = dx / distance;
        const ny = dy / distance;
        const dvx = b.vx - a.vx;
        const dvy = b.vy - a.vy;
        let impulse = -(1 + restitution) * (dvx * nx + dvy * ny);
        impulse /= (1 / a.mass + 1 / b.mass);
        const impulseX = impulse * nx;
        const impulseY = impulse * ny;
        
        // Apply impulse
        a.vx -= impulseX / a.mass;
        a.vy -= impulseY / a.mass;
        b.vx += impulseX / b.mass;
        b.vy += impulseY / b.mass;
        
        // Separate particles
        const overlap = minDist - distance;
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;
    }
}

export function resolveBoundaryCollision(particle: Particle, width: number, height: number, restitution: number): void {
    if (particle.x + particle.radius > width) {
        particle.x = width - particle.radius;
        particle.vx = -Math.abs(particle.vx) * restitution;
    }
    if (particle.x - particle.radius < 0) {
        particle.x = particle.radius;
        particle.vx = Math.abs(particle.vx) * restitution;
    }
    if (particle.y + particle.radius > height) {
        particle.y = height - particle.radius;
        particle.vy = -Math.abs(particle.vy) * restitution;
    }
    if (particle.y - particle.radius < 0) {
        particle.y = particle.radius;
        particle.vy = Math.abs(particle.vy) * restitution;
    }
}