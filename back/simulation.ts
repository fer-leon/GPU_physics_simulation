// back/simulation.ts
// La clase Simulation gestiona la simulación de partículas, actualizándolas
// dividiéndolas en substeps para simular un movimiento suave. Ahora se utiliza
// la función optimizada de detección de colisiones basada en spatial partitioning.

import { Particle } from "./particle.ts";
// Se elimina el uso de solveCollision de collisionSolver.ts para emplear la versión optimizada.
import { spatialPartitioning } from "./grid.ts";

export class Simulation {
  particles: Particle[];
  width: number;
  height: number;

  constructor(particleCount: number = 10, width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      // Masa aleatoria entre 1 y 5
      const mass = 1 + Math.random() * 4;
      // Radio proporcional a la masa (entre 5 y 15)
      const radius = 5 + (mass - 1) * 2.5;

      const p = new Particle(
        Math.random() * width,
        Math.random() * height,
        mass, // masa aleatoria
        radius, // radio proporcional
      );
      // Se asigna una velocidad inicial aleatoria.
      p.vx = (Math.random() - 0.5) * 100;
      p.vy = (Math.random() - 0.5) * 100;
      this.particles.push(p);
    }
  }

  // Calcula un frame entero de simulación dividido en 4 substeps.
  simulateFrame(deltaTime: number): void {
    const substepTime = deltaTime / 4;
    for (let i = 0; i < 4; i++) {
      // Se actualiza la posición de las partículas.
      this.updateParticles(substepTime);
      // Se aplican las colisiones con optimización de spatial partitioning.
      spatialPartitioning(this.particles, this.width, this.height);
    }
  }

  // Actualiza la posición de las partículas en función de su velocidad y aceleración.
  updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.vx += particle.ax * delta;
      particle.vy += particle.ay * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      // Se reinicia la aceleración tras actualizar la posición.
      particle.ax = 0;
      particle.ay = 0;
    }
  }

  // Serializa el estado actual para enviarlo al frontend vía WebSocket.
  getState(): string {
    return JSON.stringify({
      particles: this.particles.map((p) => ({
        x: p.x,
        y: p.y,
        radius: p.radius,
      })),
    });
  }
}
