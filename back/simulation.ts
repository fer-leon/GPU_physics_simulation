import { Particle } from "./particle.ts";
import { parallelSpatialPartitioning } from "./grid.ts";

export class Simulation {
  particles: Particle[];
  width: number;
  height: number;

  constructor(particleCount: number = 10, width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const mass = 1 + Math.random() * 4;
      const radius = 5 + (mass - 1) * 2.5;
      
      const p = new Particle(
        Math.random() * width,
        Math.random() * height,
        mass,
        radius,
      );
      
      p.vx = (Math.random() - 0.5) * 100;
      p.vy = (Math.random() - 0.5) * 100;
      this.particles.push(p);
    }
  }

  async simulateFrame(deltaTime: number): Promise<void> {
    const substepTime = deltaTime / 4;
    // Realizar integración física en 4 subpasos
    for (let i = 0; i < 4; i++) {
      this.updateParticles(substepTime);
    }
    // Ejecutar detección de colisiones una sola vez
    await parallelSpatialPartitioning(this.particles, this.width, this.height);
  }

  updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.vx += particle.ax * delta;
      particle.vy += particle.ay * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.ax = 0;
      particle.ay = 0;
    }
  }

  getState(): string {
    return JSON.stringify({
      particles: this.particles.map((p) => ({
        x: p.x,
        y: p.y,
        radius: p.radius,
      })),
    });
  }

  getStateBuffer(): ArrayBuffer {
    const n = this.particles.length;
    // 4 bytes para numero de partículas y 12 bytes por partícula (x, y, radio)
    const buffer = new ArrayBuffer(4 + n * 12);
    const view = new DataView(buffer);
    view.setUint32(0, n, true);
    let offset = 4;
    for (const p of this.particles) {
      view.setFloat32(offset, p.x, true);
      offset += 4;
      view.setFloat32(offset, p.y, true);
      offset += 4;
      view.setFloat32(offset, p.radius, true);
      offset += 4;
    }
    return buffer;
  }
}