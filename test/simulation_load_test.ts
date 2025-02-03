// test/simulation_load_test.ts
import { Simulation } from "../back/simulation.ts";

// Periodo de medición en milisegundos
const testDurationMs = 1000;
// Delta de tiempo por frame (en segundos)
const frameTime = 0.016;

/**
 * Ejecuta el test de FPS para la simulación.
 * @param particleCount Número de partículas en la simulación.
 * @param fpsThreshold FPS mínimos requeridos.
 */
function runFPSTest(particleCount: number, fpsThreshold: number) {
  const sim = new Simulation(particleCount, 4000, 3200);
  const startTime = performance.now();
  let frames = 0;
  
  while (performance.now() - startTime < testDurationMs) {
    sim.simulateFrame(frameTime);
    frames++;
  }
  
  const actualDuration = (performance.now() - startTime) / 1000;
  const fps = frames / actualDuration;
  console.log(`FPS para ${particleCount} partículas: ${fps.toFixed(2)} fps (medidos en ${actualDuration.toFixed(2)} segundos)`);
  
  if (fps < fpsThreshold) {
    throw new Error(`La simulación con ${particleCount} partículas es demasiado lenta (${fps.toFixed(2)} fps < ${fpsThreshold} fps)`);
  }
}

Deno.test("FPS 1000 partículas", async () => {
  await runFPSTest(1000, 55);
});

Deno.test("FPS 5000 partículas", async () => {
  await runFPSTest(5000, 20);
});

// Repetimos otra medición para 1000 partículas para comparar consistencia.
Deno.test("FPS 1000 partículas (segunda ejecución)", async () => {
  await runFPSTest(1000, 55);
});