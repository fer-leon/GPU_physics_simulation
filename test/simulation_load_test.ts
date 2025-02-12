// test/simulation_load_test.ts
import { Simulation } from "../back/simulation.ts";

const testDurationMs = 1000;
const frameTime = 0.016;
const iterations = 5;

async function runSingleFPSTest(particleCount: number): Promise<number> {
  const sim = new Simulation(particleCount, 4000, 3200);
  const startTime = performance.now();
  let frames = 0;
  
  while (performance.now() - startTime < testDurationMs) {
    await sim.simulateFrame(frameTime);
    frames++;
  }
  
  const actualDuration = (performance.now() - startTime) / 1000;
  return frames / actualDuration;
}

async function runAverageFPSTest(particleCount: number, fpsThreshold: number) {
  const fpsList: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    fpsList.push(await runSingleFPSTest(particleCount));
  }
  
  const avgFps = fpsList.reduce((a, b) => a + b) / iterations;
  console.log(`Average FPS for ${particleCount} particles: ${avgFps.toFixed(2)} fps (${iterations} iterations)`);
  console.log(`Individual FPS: ${fpsList.map(fps => fps.toFixed(2)).join(", ")}`);
  
  if (avgFps < fpsThreshold) {
    throw new Error(`Simulation with ${particleCount} particles is too slow (${avgFps.toFixed(2)} fps < ${fpsThreshold} fps)`);
  }
}

Deno.test("FPS with 1000 particles", async () => {
  await runAverageFPSTest(1000, 1000);
});

Deno.test("FPS with 5000 particles", async () => {
  await runAverageFPSTest(5000, 150);
});

Deno.test("FPS with 15000 particles", async () => {
  await runAverageFPSTest(15000, 100);
});