import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { Simulation } from "./back/simulation.ts";

// Se lee el HTML del cliente desde el sistema de archivos.
const html = await Deno.readTextFile("front/index.html");

// Inicializa la simulación, que se actualizará periódicamente.
const simulation = new Simulation(5000, 4000, 3200);
let simulationInterval: number | null = null;

// Crea un servidor HTTP que responde según la URL.
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

console.log("Servidor HTTP en http://localhost:8000/");

// Se crea el WebSocket server en el puerto 8001 para transmitir el estado de la simulación.
const wss = new WebSocketServer(8001);

// Maneja nuevas conexiones de WebSocket.
wss.on("connection", (_ws) => {
  console.log("Cliente conectado al WebSocket");
});

// Intervalo de actualización para la simulación (aprox. 60 fps)
const frameTime = 0.016; // en segundos
simulationInterval = setInterval(async () => {
  await simulation.simulateFrame(frameTime);
  const stateBuffer = simulation.getStateBuffer();
  // Se envía el estado actualizado a todos los clientes conectados.
  for (const client of wss.clients) {
    try {
      client.send(new Uint8Array(stateBuffer));
    } catch (error) {
      console.error("Error al enviar a cliente:", error);
    }
  }
}, frameTime * 1000);

// Función para detener la simulación, por ejemplo, al recibir cierta señal
export function stopSimulation(): void {
  if (simulationInterval !== null) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  // Terminar los workers creados
  import("./back/grid.ts").then(({ terminateWorkerPool }) => terminateWorkerPool());
  console.log("Simulación detenida.");
}