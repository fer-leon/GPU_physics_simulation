import { GPUSimulation } from "./gpu_simulation.ts";

interface SimParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
}

export class Simulation {
  gpuSim: GPUSimulation;
  width: number;
  height: number;

  constructor(particleCount: number = 10, width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.gpuSim = new GPUSimulation(particleCount, width, height);
  }

  async init(): Promise<void> {
    await this.gpuSim.init();
  }

  async simulateFrame(deltaTime: number): Promise<void> {
    await this.gpuSim.simulateFrame(deltaTime);
  }

  getState(): string {
    return this.gpuSim.getState();
  }

  getStateBuffer(): ArrayBuffer {
    return this.gpuSim.getStateBuffer();
  }

  get particles() {
    const particleData = this.gpuSim.particles;
    const result = [];
    for (let i = 0; i < particleData.length; i += 7) {
      result.push({
        id: particleData[i],
        x: particleData[i + 1],
        y: particleData[i + 2],
        vx: particleData[i + 3],
        vy: particleData[i + 4],
        mass: particleData[i + 5],
        radius: particleData[i + 6],
      });
    }
    return result;
  }

  set particles(newParticles: SimParticle[]) {
    const particleData = new Float32Array(newParticles.length * 7);
    newParticles.forEach((p, i) => {
      const base = i * 7;
      particleData[base] = p.id;
      particleData[base + 1] = p.x;
      particleData[base + 2] = p.y;
      particleData[base + 3] = p.vx;
      particleData[base + 4] = p.vy;
      particleData[base + 5] = p.mass;
      particleData[base + 6] = p.radius;
    });
    this.gpuSim.particles = particleData;
  }
}