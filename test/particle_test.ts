import { Particle } from "../back/particle.ts";
import { assertEquals } from "@std/assert";

Deno.test("Particle initializes with correct properties", () => {
    const p = new Particle(10, 20, 2, 5);
    assertEquals(p.x, 10);
    assertEquals(p.mass, 2);
    assertEquals(p.radius, 5);
});

Deno.test("Particle uses default mass and radius", () => {
    const p = new Particle(0, 0);
    assertEquals(p.mass, 1);
    assertEquals(p.radius, 5);
});