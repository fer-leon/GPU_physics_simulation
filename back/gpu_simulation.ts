import { resolveParticleCollision, resolveBoundaryCollision } from "./collision.ts";
import { Particle } from "./particle.ts";

export class GPUSimulation {
  private device?: GPUDevice;
  private computePipeline?: GPUComputePipeline;
  private particleBuffers?: GPUBuffer[];
  private paramsBuffer?: GPUBuffer;
  private bindGroups?: GPUBindGroup[];
  private currentBufferIndex = 0;
  private stagingBuffer?: GPUBuffer;
  private _particles: Float32Array;
  private isGPU = false;
  width: number;
  height: number;

  private gridBuffer?: GPUBuffer;
  private cellCountsBuffer?: GPUBuffer;
  private updatePipeline?: GPUComputePipeline;
  private collisionPipeline?: GPUComputePipeline;
  private updateBindGroup?: GPUBindGroup;
  private collisionBindGroup?: GPUBindGroup;
  private cellSize = 30;
  private gridCols: number;
  private gridRows: number;
  private maxParticlesPerCell = 64;

  constructor(particleCount: number = 10, width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this._particles = new Float32Array(particleCount * 7); // 7 values per particle
    
    // Initialize particles with random positions and velocities
    for (let i = 0; i < particleCount; i++) {
      const base = i * 7;
      const mass = 1 + Math.random() * 4;
      const radius = 5 + (mass - 1) * 2.5;
      
      this._particles[base] = i; // id
      this._particles[base + 1] = Math.random() * width; // x
      this._particles[base + 2] = Math.random() * height; // y
      this._particles[base + 3] = (Math.random() - 0.5) * 100; // vx
      this._particles[base + 4] = (Math.random() - 0.5) * 100; // vy
      this._particles[base + 5] = mass;
      this._particles[base + 6] = radius;
    }
    this.gridCols = Math.ceil(width / this.cellSize);
    this.gridRows = Math.ceil(height / this.cellSize);
  }

  async init(): Promise<void> {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) throw new Error("WebGPU not supported");
      
      this.device = await adapter.requestDevice();

      const shaderCode = await Deno.readTextFile(new URL("./shader.wgsl", import.meta.url));

      // Create particle buffers for double buffering
      this.particleBuffers = [
        this.device.createBuffer({
          size: this._particles.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        }),
        this.device.createBuffer({
          size: this._particles.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })
      ];

      // Initialize first buffer with particle data
      this.device.queue.writeBuffer(this.particleBuffers[0], 0, this._particles);

      // Create grid buffers
      const gridSize = this.gridCols * this.gridRows * this.maxParticlesPerCell;
      this.gridBuffer = this.device.createBuffer({
        size: gridSize * 4, // u32 indices
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.cellCountsBuffer = this.device.createBuffer({
        size: this.gridCols * this.gridRows * 4, // u32 counts
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      // Create simulation parameters buffer
      this.paramsBuffer = this.device.createBuffer({
        size: 8 * 4, // 8 f32 values
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create staging buffer for reading results
      this.stagingBuffer = this.device.createBuffer({
        size: this._particles.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Create bind group layout
      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          { // Input particles
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" }
          },
          { // Output particles
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" }
          },
          { // Simulation parameters
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
          }
        ]
      });

      // Create bind group layouts
      const updateBindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" }},
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }},
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" }},
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }},
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }}
        ]
      });

      const collisionBindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" }},
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }},
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" }},
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }},
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }}
        ]
      });

      // Create bind groups for double buffering
      this.bindGroups = [
        this.device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.particleBuffers[0] } },
            { binding: 1, resource: { buffer: this.particleBuffers[1] } },
            { binding: 2, resource: { buffer: this.paramsBuffer } }
          ]
        }),
        this.device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.particleBuffers[1] } },
            { binding: 1, resource: { buffer: this.particleBuffers[0] } },
            { binding: 2, resource: { buffer: this.paramsBuffer } }
          ]
        })
      ];

      // Create compute pipeline
      this.computePipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout]
        }),
        compute: {
          module: this.device.createShaderModule({ code: shaderCode }),
          entryPoint: "main"
        }
      });

      // Create pipelines
      this.updatePipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [updateBindGroupLayout]
        }),
        compute: {
          module: this.device.createShaderModule({ code: shaderCode }),
          entryPoint: "updatePositions"
        }
      });

      this.collisionPipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [collisionBindGroupLayout]
        }),
        compute: {
          module: this.device.createShaderModule({ code: shaderCode }),
          entryPoint: "resolveCollisions"
        }
      });

      // Create bind groups
      this.updateBindGroup = this.device.createBindGroup({
        layout: updateBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffers[0] }},
          { binding: 1, resource: { buffer: this.particleBuffers[1] }},
          { binding: 2, resource: { buffer: this.paramsBuffer }},
          { binding: 3, resource: { buffer: this.gridBuffer }},
          { binding: 4, resource: { buffer: this.cellCountsBuffer }}
        ]
      });

      this.collisionBindGroup = this.device.createBindGroup({
        layout: collisionBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffers[0] }},
          { binding: 1, resource: { buffer: this.particleBuffers[1] }},
          { binding: 2, resource: { buffer: this.paramsBuffer }},
          { binding: 3, resource: { buffer: this.gridBuffer }},
          { binding: 4, resource: { buffer: this.cellCountsBuffer }}
        ]
      });

      this.isGPU = true;
    } catch (e) {
      console.log("WebGPU not available, falling back to CPU simulation");
      this.isGPU = false;
    }
  }

  private async simulateGPU(deltaTime: number): Promise<void> {
    if (!this.device || !this.particleBuffers || !this.paramsBuffer || 
        !this.updatePipeline || !this.collisionPipeline || !this.stagingBuffer ||
        !this.gridBuffer || !this.cellCountsBuffer || 
        !this.updateBindGroup || !this.collisionBindGroup) {
      throw new Error("GPU simulation not initialized");
    }

    // Clear grid counters with a zero-filled buffer
    const clearCountsBuffer = this.device.createBuffer({
      size: this.gridCols * this.gridRows * 4,
      usage: GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Uint32Array(clearCountsBuffer.getMappedRange()).fill(0);
    clearCountsBuffer.unmap();

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      clearCountsBuffer, 0,
      this.cellCountsBuffer, 0,
      this.gridCols * this.gridRows * 4
    );

    // Update simulation parameters
    const paramsData = new Float32Array([
      this.width,
      this.height,
      deltaTime,
      0.9, // restitution
      this.cellSize,
      this.gridCols,
      this.gridRows,
      this._particles.length / 7, // particle count
    ]);
    this.device.queue.writeBuffer(this.paramsBuffer, 0, paramsData);

    // First pass: update positions and assign to grid
    const updatePass = commandEncoder.beginComputePass();
    updatePass.setPipeline(this.updatePipeline);
    updatePass.setBindGroup(0, this.updateBindGroup);
    updatePass.dispatchWorkgroups(Math.ceil(this._particles.length / 7 / 256));
    updatePass.end();

    // Second pass: resolve collisions
    const collisionPass = commandEncoder.beginComputePass();
    collisionPass.setPipeline(this.collisionPipeline);
    collisionPass.setBindGroup(0, this.collisionBindGroup);
    collisionPass.dispatchWorkgroups(Math.ceil(this._particles.length / 7 / 256));
    collisionPass.end();

    // Copy results back
    commandEncoder.copyBufferToBuffer(
      this.particleBuffers[1],
      0,
      this.stagingBuffer,
      0,
      this._particles.byteLength
    );

    // Submit all commands at once
    this.device.queue.submit([commandEncoder.finish()]);

    // Clean up
    clearCountsBuffer.destroy();

    // Read back results only when needed (e.g., for rendering)
    await this.stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(this.stagingBuffer.getMappedRange());
    this._particles.set(data);
    this.stagingBuffer.unmap();
  }

  private simulateCPU(deltaTime: number): void {
    const count = this._particles.length / 7;
    const particles: Particle[] = Array(count).fill(0).map((_, i) => {
      const p = new Particle(
        this._particles[i * 7 + 1],
        this._particles[i * 7 + 2],
        this._particles[i * 7 + 5],
        this._particles[i * 7 + 6]
      );
      p.id = this._particles[i * 7];
      p.vx = this._particles[i * 7 + 3];
      p.vy = this._particles[i * 7 + 4];
      return p;
    });

    // Update positions
    for (const p of particles) {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
    }

    // Spatial partitioning
    const cellSize = 30; // Same as WebWorker implementation
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);
    const grid: Particle[][] = Array(cols * rows).fill(null).map(() => []);

    // Assign particles to grid cells
    for (const p of particles) {
      const cellX = Math.floor(p.x / cellSize);
      const cellY = Math.floor(p.y / cellSize);
      if (cellX >= 0 && cellX < cols && cellY >= 0 && cellY < rows) {
        grid[cellY * cols + cellX].push(p);
      }
    }

    // Check collisions using grid
    const neighborOffsets = [
      { dx: 0, dy: 0 }, // Same cell
      { dx: 1, dy: 0 }, // Right
      { dx: -1, dy: 1 }, // Bottom left
      { dx: 0, dy: 1 }, // Bottom
      { dx: 1, dy: 1 }, // Bottom right
    ];

    const checkedPairs = new Set<string>();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y * cols + x];
        
        for (const offset of neighborOffsets) {
          const nx = x + offset.dx;
          const ny = y + offset.dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          
          const neighborCell = grid[ny * cols + nx];
          
          // Check collisions between particles in current cell and neighbor cell
          for (const p1 of cell) {
            const otherParticles = x === nx && y === ny ? cell : neighborCell;
            for (const p2 of otherParticles) {
              if (p1 === p2) continue;
              
              const pairKey = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
              if (checkedPairs.has(pairKey)) continue;
              checkedPairs.add(pairKey);
              
              const changes = resolveParticleCollision(p1, p2, 0.9);
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
      }
    }

    // Check boundary collisions
    for (const p of particles) {
      const changes = resolveBoundaryCollision(p, this.width, this.height, 0.9);
      if (changes.x !== undefined) p.x = changes.x;
      if (changes.y !== undefined) p.y = changes.y;
      if (changes.vx !== undefined) p.vx = changes.vx;
      if (changes.vy !== undefined) p.vy = changes.vy;
    }

    // Update particle data
    particles.forEach((p, i) => {
      const base = i * 7;
      this._particles[base + 1] = p.x;
      this._particles[base + 2] = p.y;
      this._particles[base + 3] = p.vx;
      this._particles[base + 4] = p.vy;
    });
  }

  async simulateFrame(deltaTime: number): Promise<void> {
    if (this.isGPU) {
      await this.simulateGPU(deltaTime);
    } else {
      this.simulateCPU(deltaTime);
    }
  }

  getState(): string {
    const state = [];
    for (let i = 0; i < this._particles.length; i += 7) {
      state.push({
        x: this._particles[i + 1],
        y: this._particles[i + 2],
        radius: this._particles[i + 6]
      });
    }
    return JSON.stringify({ particles: state });
  }

  getStateBuffer(): ArrayBuffer {
    const count = this._particles.length / 7;
    const buffer = new ArrayBuffer(4 + count * 12);
    const view = new DataView(buffer);
    view.setUint32(0, count, true);
    
    let offset = 4;
    for (let i = 0; i < this._particles.length; i += 7) {
      view.setFloat32(offset, this._particles[i + 1], true); // x
      offset += 4;
      view.setFloat32(offset, this._particles[i + 2], true); // y
      offset += 4;
      view.setFloat32(offset, this._particles[i + 6], true); // radius
      offset += 4;
    }
    return buffer;
  }

  get particles(): Float32Array {
    return this._particles;
  }

  set particles(newParticles: Float32Array) {
    this._particles = newParticles;
    if (this.isGPU && this.device && this.particleBuffers) {
      this.device.queue.writeBuffer(this.particleBuffers[0], 0, this._particles);
    }
  }
}