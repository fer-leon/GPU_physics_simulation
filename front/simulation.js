const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let previousState = null;
let currentState = null;
let lastUpdate = performance.now();
let simWidth = 0;
let simHeight = 0;
let scale = 1;
let ws = null;
let reconnectTimeout = null;
const RECONNECT_DELAY = 2000; // 2 seconds

// Fetch simulation dimensions
fetch('http://localhost:8000/dimensions')
  .then(response => response.json())
  .then(dimensions => {
    simWidth = dimensions.width;
    simHeight = dimensions.height;
    document.getElementById('sim-width').textContent = simWidth;
    document.getElementById('sim-height').textContent = simHeight;
    updateCanvasSize();
  });

function updateCanvasSize() {
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // Calculate scale to fit simulation in container while maintaining aspect ratio
  const scaleX = containerWidth / simWidth;
  const scaleY = containerHeight / simHeight;
  scale = Math.min(scaleX, scaleY) * 0.95; // 95% to add some margin

  canvas.width = simWidth * scale;
  canvas.height = simHeight * scale;
}

window.addEventListener('resize', updateCanvasSize);

function updateConnectionStatus(status) {
  const statusElement = document.getElementById('connection-status');
  statusElement.className = 'connection-status ' + status;
  
  switch(status) {
    case 'connected':
      statusElement.textContent = 'Conectado';
      break;
    case 'disconnected':
      statusElement.textContent = 'Desconectado';
      break;
    case 'connecting':
      statusElement.textContent = 'Reconectando...';
      break;
  }
}

function connectWebSocket() {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket("ws://localhost:8001");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    console.log("Connected to WebSocket");
    updateConnectionStatus('connected');
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  ws.onclose = () => {
    console.log("Disconnected from WebSocket");
    updateConnectionStatus('disconnected');
    // Schedule reconnection
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(() => {
        updateConnectionStatus('connecting');
        connectWebSocket();
      }, RECONNECT_DELAY);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    ws.close(); // This will trigger onclose and attempt reconnection
  };

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const view = new DataView(event.data);
      const n = view.getUint32(0, true);
      const particles = [];
      let offset = 4;
      
      document.getElementById('particle-count').textContent = n;
      
      for (let i = 0; i < n; i++) {
        const x = view.getFloat32(offset, true);
        offset += 4;
        const y = view.getFloat32(offset, true);
        offset += 4;
        const radius = view.getFloat32(offset, true);
        offset += 4;
        particles.push({ x, y, radius });
      }
      
      if (!currentState) {
        currentState = { particles };
        previousState = { particles };
      } else {
        previousState = currentState;
        currentState = { particles };
      }
    }
    lastUpdate = performance.now();
  };
}

function interpolate(prev, curr, t) {
  if (!previousState || !currentState) return;
  const interpParticles = curr.particles.map((p, i) => {
    if (!prev || !prev.particles[i]) return p;
    const pPrev = prev.particles[i];
    return {
      x: pPrev.x + (p.x - pPrev.x) * t,
      y: pPrev.y + (p.y - pPrev.y) * t,
      radius: p.radius,
    };
  });
  return { particles: interpParticles };
}

function render() {
  requestAnimationFrame(render);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const now = performance.now();
  const delta = now - lastUpdate;
  let t = Math.min(delta / 16, 1);
  
  const displayState = interpolate(previousState, currentState, t) || currentState;

  if (displayState && displayState.particles) {
    ctx.save();
    ctx.scale(scale, scale);
    
    displayState.particles.forEach(particle => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#3498db";
      ctx.strokeStyle = "#2980b9";
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    });
    
    ctx.restore();
  }
}

// Iniciar la conexión WebSocket y el renderizado
connectWebSocket();
render();