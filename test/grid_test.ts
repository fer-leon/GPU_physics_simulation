import { spatialPartitioning } from "../back/grid.ts";
import { Particle } from "../back/particle.ts";
import { assertAlmostEquals } from "@std/assert";

Deno.test("spatialPartitioning handles collisions in same cell", () => {
    const particle1 = new Particle(100, 100, 1, 1);
    const particle2 = new Particle(101.5, 100, 1, 1);
    particle1.vx = 2;
    particle2.vx = -1;

    spatialPartitioning([particle1, particle2], 800, 600);

    assertAlmostEquals(particle1.vx, -0.85, 1e-9);
    assertAlmostEquals(particle2.vx, 1.85, 1e-9);
});