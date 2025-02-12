import { parallelSpatialPartitioning } from "../back/grid.ts";
import { Particle } from "../back/particle.ts";
import { assertAlmostEquals } from "@std/assert";

Deno.test("spatialPartitioning handles collisions in same cell", async () => {
    const particle1 = new Particle(100, 100, 1, 1);
    const particle2 = new Particle(101.5, 100, 1, 1);
    particle1.vx = 2;
    particle2.vx = -1;

    // Wait for parallel detection to complete
    await parallelSpatialPartitioning([particle1, particle2], 800, 600);
    
    // Changes should be applied to the original objects
    assertAlmostEquals(particle1.vx, -0.85, 1e-9);
    assertAlmostEquals(particle2.vx, 1.85, 1e-9);
});