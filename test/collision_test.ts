import { resolveParticleCollision, resolveBoundaryCollision } from "../back/collision.ts";
import { Particle } from "../back/particle.ts";
import { assertEquals } from "@std/assert";

Deno.test("resolveParticleCollision swaps velocities and separates particles", () => {
    const a = new Particle(0, 0, 1, 1.5);
    const b = new Particle(2, 0, 1, 1.5);
    a.vx = 2;
    b.vx = -2;
    resolveParticleCollision(a, b, 1);
    assertEquals(a.vx, -2);
    assertEquals(b.vx, 2);
    assertEquals(Math.hypot(b.x - a.x, b.y - a.y), 3);
});

Deno.test("resolveBoundaryCollision corrects position and velocity", () => {
    const width = 800, height = 600;
    const p = new Particle(810, 300, 1, 10);
    p.vx = 10;
    resolveBoundaryCollision(p, width, height, 0.5);
    assertEquals(p.x, 790);
    assertEquals(p.vx, -5);
});