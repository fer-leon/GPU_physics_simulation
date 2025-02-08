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
    gridCols: u32,
    gridRows: u32,
    particleCount: u32,
}

@group(0) @binding(0) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;
@group(0) @binding(2) var<uniform> params: SimParams;
@group(0) @binding(3) var<storage, read_write> grid: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> cellCounts: array<atomic<u32>>;

var<workgroup> sharedParticles: array<Particle, 256>;
var<workgroup> sharedCounts: array<u32, 256>;

fn getGridIndex(x: f32, y: f32) -> i32 {
    let cellX = i32(x / params.cellSize);
    let cellY = i32(y / params.cellSize);
    if (cellX < 0 || cellX >= i32(params.gridCols) || cellY < 0 || cellY >= i32(params.gridRows)) {
        return -1;
    }
    return cellY * i32(params.gridCols) + cellX;
}

fn resolveCollision(p1: ptr<function, Particle>, p2: ptr<function, Particle>) -> bool {
    let dx = (*p2).x - (*p1).x;
    let dy = (*p2).y - (*p1).y;
    let distSq = dx * dx + dy * dy;
    let minDist = (*p1).radius + (*p2).radius;
    let minDistSq = minDist * minDist;
    
    if (distSq >= minDistSq || distSq == 0.0) { return false; }
    
    let distance = sqrt(distSq);
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
    
    let overlap = (minDist - distance) * 0.5;
    (*p1).x = (*p1).x - nx * overlap;
    (*p1).y = (*p1).y - ny * overlap;
    (*p2).x = (*p2).x + nx * overlap;
    (*p2).y = (*p2).y + ny * overlap;
    
    return true;
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
fn updatePositions(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.particleCount) {
        return;
    }

    // Cargar partícula en memoria compartida
    sharedParticles[local_id.x] = particlesIn[index];
    var particle = &sharedParticles[local_id.x];
    
    // Update position
    (*particle).x = (*particle).x + (*particle).vx * params.deltaTime;
    (*particle).y = (*particle).y + (*particle).vy * params.deltaTime;
    
    // Check boundaries
    checkBoundaries(particle);
    
    // Guardar la partícula actualizada
    particlesOut[index] = *particle;
    
    // Asignar a la cuadrícula
    let cellIndex = getGridIndex((*particle).x, (*particle).y);
    if (cellIndex >= 0) {
        let count = atomicAdd(&cellCounts[cellIndex], 1u);
        if (count < 64u) {
            let gridIndex = cellIndex * 64 + i32(count);
            atomicStore(&grid[gridIndex], index);
        }
    }
}

@compute @workgroup_size(256)
fn resolveCollisions(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.particleCount) {
        return;
    }

    // Load particle into shared memory
    sharedParticles[local_id.x] = particlesOut[index];
    var particle = &sharedParticles[local_id.x];
    let cellIndex = getGridIndex((*particle).x, (*particle).y);
    if (cellIndex < 0) {
        return;
    }

    let baseCellX = i32((*particle).x / params.cellSize);
    let baseCellY = i32((*particle).y / params.cellSize);
    var collided = false;

    // Optimized neighbor cell checking
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let neighborX = baseCellX + dx;
            let neighborY = baseCellY + dy;
            
            if (neighborX < 0 || neighborX >= i32(params.gridCols) || 
                neighborY < 0 || neighborY >= i32(params.gridRows)) {
                continue;
            }

            let neighborCellIndex = neighborY * i32(params.gridCols) + neighborX;
            let particleCount = atomicLoad(&cellCounts[neighborCellIndex]);
            
            for (var j = 0u; j < min(particleCount, 64u); j++) {
                let otherIndex = atomicLoad(&grid[neighborCellIndex * 64 + i32(j)]);
                if (otherIndex == index) {
                    continue;
                }

                var other = particlesOut[otherIndex];
                if (resolveCollision(particle, &other)) {
                    particlesOut[otherIndex] = other;
                    collided = true;
                }
            }
        }
    }

    if (collided) {
        particlesOut[index] = *particle;
    }
}