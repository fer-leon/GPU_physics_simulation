import { Simulation } from "../back/simulation.ts";
import { Particle } from "../back/particle.ts";
import { assertEquals, assertAlmostEquals } from "@std/assert";

Deno.test("Simulation initializes with default 10 particles", () => {
    const sim = new Simulation();
    assertEquals(sim.particles.length, 10);
});

Deno.test("Simulation initializes with custom particle count", () => {
    const sim = new Simulation(20, 1000, 800);
    assertEquals(sim.particles.length, 20);
});

Deno.test("simulateFrame updates positions correctly", () => {
    const sim = new Simulation();
    const p = new Particle(10, 10, 1, 5);
    p.vx = 100;
    sim.particles = [p];
    
    const deltaTime = 0.016;
    sim.simulateFrame(deltaTime);
    
    assertAlmostEquals(sim.particles[0].x, 11.6, 1e-9);
});