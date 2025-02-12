import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { Simulation } from "./back/simulation.ts";

// Read client HTML from filesystem
const html = await Deno.readTextFile("front/index.html");

// Initialize simulation that will be updated periodically
const simulation = new Simulation(5000, 4000, 3200);
let simulationInterval: number | null = null;

// Create HTTP server that responds based on URL
Deno.serve({
  port: 8000,
  handler: (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/dimensions") {
      return new Response(
        JSON.stringify({ width: simulation.width, height: simulation.height }),
        { headers: { "content-type": "application/json" } }
      );
    }
    return new Response(html, { headers: { "content-type": "text/html" } });
  },
});

console.log("HTTP server running at http://localhost:8000/");

// Create WebSocket server on port 8001 for simulation state transmission
const wss = new WebSocketServer(8001);

// Handle new WebSocket connections
wss.on("connection", (_ws) => {
  console.log("Client connected to WebSocket");
});

// Update interval for simulation (approx. 60 fps)
const frameTime = 0.016; // in seconds
simulationInterval = setInterval(async () => {
  await simulation.simulateFrame(frameTime);
  const stateBuffer = simulation.getStateBuffer();
  // Send updated state to all connected clients
  for (const client of wss.clients) {
    try {
      client.send(new Uint8Array(stateBuffer));
    } catch (error) {
      console.error("Error sending to client:", error);
    }
  }
}, frameTime * 1000);

// Function to stop simulation, e.g., on receiving a signal
export function stopSimulation(): void {
  if (simulationInterval !== null) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  // Terminate created workers
  import("./back/grid.ts").then(({ terminateWorkerPool }) => terminateWorkerPool());
  console.log("Simulation stopped.");
}