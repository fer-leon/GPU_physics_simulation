import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { Simulation } from "./back/simulation.ts";
import { contentType } from "https://deno.land/std@0.202.0/media_types/mod.ts";
import { join } from "https://deno.land/std@0.202.0/path/mod.ts";

// Read client HTML from filesystem
const html = await Deno.readTextFile("front/index.html");

// Initialize simulation that will be updated periodically
const simulation = new Simulation(5000, 4000, 3200);
let simulationInterval: number | null = null;
let lastClientCount = 0;

// Create HTTP server that responds based on URL
Deno.serve({
  port: 8000,
  handler: async (req) => {
    const url = new URL(req.url);
    
    if (url.pathname === "/dimensions") {
      return new Response(
        JSON.stringify({ width: simulation.width, height: simulation.height }),
        { 
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }

    // Serve static files from the front directory
    try {
      let filePath;
      if (url.pathname === "/") {
        filePath = "front/index.html";
      } else {
        // Remove leading slash and join with front directory
        filePath = join("front", url.pathname.replace(/^\//, ""));
      }

      const file = await Deno.readFile(filePath);
      const fileExt = filePath.split(".").pop() || "";
      const mimeType = contentType(fileExt) || "application/octet-stream";

      return new Response(file, {
        headers: { "content-type": mimeType }
      });
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return new Response("404 Not Found", { status: 404 });
      }
      return new Response("500 Internal Server Error", { status: 500 });
    }
  },
});

console.log("HTTP server running at http://localhost:8000/");

// Create WebSocket server on port 8001 for simulation state transmission
const wss = new WebSocketServer(8001);

// Set to track active client connections
const activeClients = new Set();

// Handle WebSocket connections
wss.on("connection", (ws) => {
  // Add client to tracking set
  activeClients.add(ws);
  lastClientCount = activeClients.size;
  console.log(`Client connected (Total: ${activeClients.size})`);

  // Handle client disconnection
  ws.on("close", () => {
    // Remove client from tracking set
    activeClients.delete(ws);
    
    // Only log if the number of clients changed
    if (activeClients.size !== lastClientCount) {
      lastClientCount = activeClients.size;
      if (activeClients.size === 0) {
        console.log("All clients disconnected");
      } else {
        console.log(`Client disconnected (Total: ${activeClients.size})`);
      }
    }
  });

  // Handle connection errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    // Remove client on error to maintain accurate count
    activeClients.delete(ws);
    lastClientCount = activeClients.size;
  });
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
      console.error("Error sending to client");
      // Try to close the connection if it appears to be broken
      try {
        client.close();
        activeClients.delete(client);
        lastClientCount = activeClients.size;
      } catch (closeError) {
        console.error("Error closing broken connection");
      }
    }
  }
}, frameTime * 1000);

// Function to stop simulation, e.g., on receiving a signal
export function stopSimulation(): void {
  if (simulationInterval !== null) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  console.log("Simulation stopped.");
}