import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { Simulation } from "./back/simulation.ts";

// Función exportada para realizar pruebas unitarias.
export function add(a: number, b: number): number {
  return a + b;
}

// Se lee el HTML del cliente desde el sistema de archivos.
const html = await Deno.readTextFile("front/index.html");

// Inicializa la simulación, que se actualizará periódicamente.
const simulation = new Simulation(5000, 4000, 3200);

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
setInterval(() => {
  simulation.simulateFrame(frameTime);
  const state = simulation.getState();
  // Se envía el estado actualizado a todos los clientes conectados.
  for (const client of wss.clients) {
    client.send(state);
  }
}, frameTime * 1000);