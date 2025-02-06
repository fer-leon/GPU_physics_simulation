export class Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  mass: number;
  radius: number;

  private static nextId = 0;

  constructor(x: number, y: number, mass: number = 1, radius: number = 5) {
    this.id = Particle.nextId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.mass = mass;
    this.radius = radius;
  }
}