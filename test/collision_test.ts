import { resolveParticleCollision, resolveBoundaryCollision } from "../back/collision.ts";
import { Particle } from "../back/particle.ts";
import { assertEquals } from "@std/assert";

Deno.test("resolveParticleCollision swaps velocities and separates particles", () => {
  const a = new Particle(0, 0, 1, 1.5);
  const b = new Particle(2, 0, 1, 1.5);
  a.vx = 2;
  b.vx = -2;
  // Obtener cambios sin modificar in situ
  const changes = resolveParticleCollision(a, b, 1);
  // Aplicar los cambios retornados
  for (const change of changes) {
    if (change.id === a.id) {
      if (change.vx !== undefined) a.vx = change.vx;
      if (change.x !== undefined) a.x = change.x;
      if (change.y !== undefined) a.y = change.y;
    } else if (change.id === b.id) {
      if (change.vx !== undefined) b.vx = change.vx;
      if (change.x !== undefined) b.x = change.x;
      if (change.y !== undefined) b.y = change.y;
    }
  }
  assertEquals(a.vx, -2);
  assertEquals(b.vx, 2);
  // La separación entre centros debe ser igual a la suma de los radios (3)
  assertEquals(Math.hypot(b.x - a.x, b.y - a.y), 3);
});

Deno.test("resolveBoundaryCollision corrects position and velocity", () => {
  const width = 800, height = 600;
  const p = new Particle(810, 300, 1, 10);
  p.vx = 10;
  // Obtener cambio
  const change = resolveBoundaryCollision(p, width, height, 0.5);
  // Aplicar el cambio si corresponde
  if (change.x !== undefined) p.x = change.x;
  if (change.vx !== undefined) p.vx = change.vx;
  
  assertEquals(p.x, 790);
  assertEquals(p.vx, -5);
});