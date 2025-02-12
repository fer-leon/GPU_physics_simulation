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
    cellSize: f32,
    particleCount: u32,
    subgroupSize: u32,
    maxCollisionChecks: u32,
}

struct Grid {
    counts: array<atomic<u32>>,
    data: array<atomic<u32>>,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var<storage, read_write> grid: Grid;

var<workgroup> sharedParticles: array<Particle, 256>;
var<workgroup> collisionCounter: atomic<u32>;

fn getGridIndex(x: f32, y: f32) -> u32 {
    let cols = u32(params.width / params.cellSize);
    return (u32(y / params.cellSize) * cols) + u32(x / params.cellSize);
}

fn resolveCollision(p1: ptr<function, Particle>, p2: ptr<function, Particle>) -> bool {
    let dx = (*p2).x - (*p1).x;
    let dy = (*p2).y - (*p1).y;
    let distSq = dx * dx + dy * dy;
    let minDist = (*p1).radius + (*p2).radius;
    let minDistSq = minDist * minDist;
    
    if (distSq >= minDistSq || distSq == 0.0) { return false; }
    
    // Avoid sqrt if possible using squared distances
    if (distSq > 0.0) {
        let dist = sqrt(distSq);
        let nx = dx / dist;
        let ny = dy / dist;
        let dvx = (*p2).vx - (*p1).vx;
        let dvy = (*p2).vy - (*p1).vy;
        let relativeSpeed = dvx * nx + dvy * ny;
        
        if (relativeSpeed > 0.0) { return false; }
        
        let j = -(1.0 + params.restitution) * relativeSpeed;
        let impulse = j / (1.0 / (*p1).mass + 1.0 / (*p2).mass);
        
        (*p1).vx = (*p1).vx - impulse * nx / (*p1).mass;
        (*p1).vy = (*p1).vy - impulse * ny / (*p1).mass;
        (*p2).vx = (*p2).vx + impulse * nx / (*p2).mass;
        (*p2).vy = (*p2).vy + impulse * ny / (*p2).mass;
        
        // Calculate separation
        let overlap = (minDist - dist) * 0.5;
        (*p1).x = (*p1).x - nx * overlap;
        (*p1).y = (*p1).y - ny * overlap;
        (*p2).x = (*p2).x + nx * overlap;
        (*p2).y = (*p2).y + ny * overlap;
        
        return true;
    }
    return false;
}

fn resolveCollisionSimple(p1: ptr<function, Particle>, p2: ptr<function, Particle>) -> bool {
    let dx = (*p2).x - (*p1).x;
    let dy = (*p2).y - (*p1).y;
    let distSq = dx * dx + dy * dy;
    let minDist = (*p1).radius + (*p2).radius;
    let minDistSq = minDist * minDist;
    
    // Ignore particles that are not in contact
    if (distSq >= minDistSq || distSq == 0.0) { return false; }
    
    let dist = sqrt(distSq);
    let nx = dx / dist;
    let ny = dy / dist;
    
    // First separate the particles
    let overlap = (minDist - dist);
    let totalMass = (*p1).mass + (*p2).mass;
    let p1Ratio = (*p2).mass / totalMass;
    let p2Ratio = (*p1).mass / totalMass;
    
    (*p1).x = (*p1).x - nx * overlap * p1Ratio;
    (*p1).y = (*p1).y - ny * overlap * p1Ratio;
    (*p2).x = (*p2).x + nx * overlap * p2Ratio;
    (*p2).y = (*p2).y + ny * overlap * p2Ratio;
    
    // Calculate relative velocity
    let dvx = (*p2).vx - (*p1).vx;
    let dvy = (*p2).vy - (*p1).vy;
    let normalVel = dvx * nx + dvy * ny;
    
    // Only resolve collision if particles are approaching
    if (normalVel >= 0.0) { return true; }
    
    // Calculate impulse with mass
    let restitution = params.restitution;
    let j = -(1.0 + restitution) * normalVel;
    j = j / (1.0/(*p1).mass + 1.0/(*p2).mass);
    
    // Apply impulse
    (*p1).vx = (*p1).vx - j * nx / (*p1).mass;
    (*p1).vy = (*p1).vy - j * ny / (*p1).mass;
    (*p2).vx = (*p2).vx + j * nx / (*p2).mass;
    (*p2).vy = (*p2).vy + j * ny / (*p2).mass;
    
    return true;
}

@compute @workgroup_size(256)
fn updatePositions(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.particleCount) {
        return;
    }

    var particle = particles[index];
    
    // Apply speed limit
    let maxSpeed = 200.0;
    let currentSpeed = sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    if (currentSpeed > maxSpeed) {
        let scale = maxSpeed / currentSpeed;
        particle.vx *= scale;
        particle.vy *= scale;
    }
    
    // Update position with friction
    let dt = params.deltaTime;
    let friction = 0.999;
    particle.vx *= friction;
    particle.vy *= friction;
    
    particle.x = particle.x + particle.vx * dt;
    particle.y = particle.y + particle.vy * dt;
    
    // Boundary collisions
    let maxX = params.width - particle.radius;
    let maxY = params.height - particle.radius;
    let minX = particle.radius;
    let minY = particle.radius;
    
    if (particle.x < minX) {
        particle.x = minX;
        particle.vx = abs(particle.vx) * params.restitution;
    } else if (particle.x > maxX) {
        particle.x = maxX;
        particle.vx = -abs(particle.vx) * params.restitution;
    }
    
    if (particle.y < minY) {
        particle.y = minY;
        particle.vy = abs(particle.vy) * params.restitution;
    } else if (particle.y > maxY) {
        particle.y = maxY;
        particle.vy = -abs(particle.vy) * params.restitution;
    }
    
    // Update grid
    let gridIndex = getGridIndex(particle.x, particle.y);
    let count = atomicAdd(&grid.counts[gridIndex], 1u);
    if (count < 64u) {
        atomicStore(&grid.data[gridIndex * 64u + count], index);
    }
    
    particles[index] = particle;
}

@compute @workgroup_size(256)
fn resolveCollisions(@builtin(global_invocation_id) global_id: vec3<u32>,
                    @builtin(local_invocation_id) local_id: vec3<u32>,
                    @builtin(workgroup_id) workgroup_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.particleCount) {
        return;
    }

    var particle = particles[index];
    let gridIndex = getGridIndex(particle.x, particle.y);
    let cols = u32(params.width / params.cellSize);
    
    // Load particle data into shared memory
    sharedParticles[local_id.x] = particle;
    workgroupBarrier();

    // Process same cell collisions with full physics
    let cellCount = atomicLoad(&grid.counts[gridIndex]);
    for (var i = 0u; i < min(cellCount, 64u); i = i + 1u) {
        let otherIndex = atomicLoad(&grid.data[gridIndex * 64u + i]);
        if (otherIndex == index || otherIndex >= params.particleCount) {
            continue;
        }
        
        var other = particles[otherIndex];
        if (resolveCollisionSimple(&particle, &other)) {
            particles[otherIndex] = other;
        }
    }
    
    // Process neighbor cells with hybrid model
    let cellX = gridIndex % cols;
    let cellY = gridIndex / cols;
    let maxDistance = params.cellSize * 2.0;
    
    for (var i = 0u; i < 4u; i = i + 1u) {
        let dx = select(-1, select(0, 1, i == 0u || i == 3u), i == 1u);
        let dy = select(0, 1, i >= 2u);
        let nx = i32(cellX) + dx;
        let ny = i32(cellY) + dy;
        
        if (nx < 0 || nx >= i32(cols) || ny < 0 || ny >= i32(params.height / params.cellSize)) {
            continue;
        }
        
        let neighborIndex = u32(ny) * cols + u32(nx);
        let neighborCount = atomicLoad(&grid.counts[neighborIndex]);
        
        for (var j = 0u; j < min(neighborCount, 64u); j = j + 1u) {
            let otherIndex = atomicLoad(&grid.data[neighborIndex * 64u + j]);
            if (otherIndex == index || otherIndex >= params.particleCount) {
                continue;
            }
            
            var other = particles[otherIndex];
            // Use hybrid collision detection based on distance
            if (resolveCollisionSimple(&particle, &other)) {
                particles[otherIndex] = other;
            }
        }
    }
    
    particles[index] = particle;
}

@compute @workgroup_size(256)
fn clearGrid(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let gridSize = u32(params.width / params.cellSize) * u32(params.height / params.cellSize);
    if (index < gridSize) {
        atomicStore(&grid.counts[index], 0u);
    }
}