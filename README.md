# GPU-Accelerated Particle Physics Simulation

A personal project to practice GPU optimizations using WebGPU and Deno. This project implements a real-time particle physics simulation that can handle thousands of particles with efficient collision detection.

## Features

- WebGPU-accelerated particle simulation with CPU fallback
- Grid-based spatial partitioning for efficient collision detection
- Real-time visualization through WebSocket streaming
- Hybrid collision resolution system
- Configurable simulation parameters
- Load testing capabilities
- Unit tests for core components

## Tech Stack

- [Deno](https://deno.land/) - Modern runtime for JavaScript and TypeScript
- WebGPU - Next-generation graphics and compute API
- WebSocket - Real-time communication between server and client
- TypeScript - Type-safe programming
- WGSL (WebGPU Shading Language) - GPU compute shaders

## Project Structure

```
/
├── back/               # Backend simulation code
│   ├── collision.ts    # Collision resolution logic
│   ├── gpu_simulation.ts # WebGPU simulation implementation
│   ├── grid.ts        # Spatial partitioning
│   ├── particle.ts    # Particle class definition
│   └── shader.wgsl    # GPU compute shader code
├── front/
│   └── index.html     # Frontend visualization
├── test/              # Test suite
└── server.ts          # WebSocket & HTTP server
```

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) installed on your system
- A browser with WebGPU support (Chrome Canary with appropriate flags)

### Running the Project

1. Clone the repository
2. Start the server:
   ```bash
   deno task dev
   ```
3. Open `http://localhost:8000` in your browser

### Running Tests

```bash
deno test
```

## Performance

The simulation includes performance testing for different particle counts:
- 1000 particles: Target 1000 FPS
- 5000 particles: Target 150 FPS
- 15000 particles: Target 100 FPS

## Implementation Details

- Uses a grid-based spatial partitioning system for collision detection
- Implements both GPU and CPU simulation paths
- WebGPU compute shaders handle particle updates and collisions
- Efficient binary state transfer via WebSocket
- Configurable parameters for mass, radius, and collision elasticity

## License

This is a personal project for learning purposes. Feel free to use it as reference.