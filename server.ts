import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("[System] Starting Drawing Server...");
  
  const app = express();
  const httpServer = createServer(app);
  
  // 1. Socket.io Setup (Ultra-Compatible)
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*" },
    transports: ["polling", "websocket"]
  });

  const rooms: Record<string, any[]> = {};

  // 2. Master Status Route (Guaranteed Response)
  app.get("/api/status", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ 
      status: "online", 
      serverTime: new Date().toISOString(),
      activeRooms: Object.keys(rooms).length
    }));
  });

  // 3. Socket Logic
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      socket.emit("canvas-state", rooms[roomId] || []);
    });

    socket.on("draw", (data) => {
      const { roomId, line } = data;
      if (!rooms[roomId]) rooms[roomId] = [];
      rooms[roomId].push(line);
      socket.to(roomId).emit("draw-update", line);
    });

    socket.on("clear-canvas", (roomId) => {
      rooms[roomId] = [];
      io.to(roomId).emit("canvas-cleared");
    });
  });

  // 4. Vite Integration (Development Mode)
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  // 5. Port Binding (The Critical Part)
  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n\n*****************************************`);
    console.log(`* SERVER IS LIVE AT http://0.0.0.0:${PORT} *`);
    console.log(`*****************************************\n\n`);
  });

  // Prevent crashes from taking down the whole app
  process.on("uncaughtException", (err) => {
    console.error("[Critical Error]", err);
  });
}

startServer().catch((err) => {
  console.error("[Fatal Error] Server failed to start:", err);
});
