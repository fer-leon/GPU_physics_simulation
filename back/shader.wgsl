struct Particle {
  id: u32,
  x: f32,
  y: f32,
  vx: f32,
  vy: f32,
  mass: f32,
  radius: f32,
}

struct SimParams {
  width: f32,
  height: f32,
  deltaTime: f32,
  restitution: f32,
}

@group(0) @binding(0) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;
@group(0) @binding(2) var<uniform> params: SimParams;

fn resolveCollision(p1: ptr<function, Particle>, p2: ptr<function, Particle>) {
    let dx = (*p2).x - (*p1).x;
    let dy = (*p2).y - (*p1).y;
    let distance = sqrt(dx * dx + dy * dy);
    let minDist = (*p1).radius + (*p2).radius;
    
    if (distance >= minDist || distance == 0.0) { return; }
    
    let nx = dx / distance;
    let ny = dy / distance;
    let dvx = (*p2).vx - (*p1).vx;
    let dvy = (*p2).vy - (*p1).vy;
    var impulse = -(1.0 + params.restitution) * (dvx * nx + dvy * ny);
    impulse = impulse / (1.0 / (*p1).mass + 1.0 / (*p2).mass);
    
    (*p1).vx = (*p1).vx - impulse * nx / (*p1).mass;
    (*p1).vy = (*p1).vy - impulse * ny / (*p1).mass;
    (*p2).vx = (*p2).vx + impulse * nx / (*p2).mass;
    (*p2).vy = (*p2).vy + impulse * ny / (*p2).mass;
    
    // Separate particles
    let overlap = (minDist - distance) * 0.5;
    (*p1).x = (*p1).x - nx * overlap;
    (*p1).y = (*p1).y - ny * overlap;
    (*p2).x = (*p2).x + nx * overlap;
    (*p2).y = (*p2).y + ny * overlap;
}

fn checkBoundaries(p: ptr<function, Particle>) {
    if ((*p).x + (*p).radius > params.width) {
        (*p).x = params.width - (*p).radius;
        (*p).vx = -abs((*p).vx) * params.restitution;
    }
    if ((*p).x - (*p).radius < 0.0) {
        (*p).x = (*p).radius;
        (*p).vx = abs((*p).vx) * params.restitution;
    }
    if ((*p).y + (*p).radius > params.height) {
        (*p).y = params.height - (*p).radius;
        (*p).vy = -abs((*p).vy) * params.restitution;
    }
    if ((*p).y - (*p).radius < 0.0) {
        (*p).y = (*p).radius;
        (*p).vy = abs((*p).vy) * params.restitution;
    }
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particlesIn)) {
        return;
    }

    var particle = particlesIn[index];
    
    // Update position
    particle.x = particle.x + particle.vx * params.deltaTime;
    particle.y = particle.y + particle.vy * params.deltaTime;
    
    // Check boundaries
    checkBoundaries(&particle);
    
    // Check collisions with nearby particles
    for (var i: u32 = 0u; i < arrayLength(&particlesIn); i++) {
        if (i == index) { continue; }
        var other = particlesIn[i];
        resolveCollision(&particle, &other);
    }
    
    particlesOut[index] = particle;
}