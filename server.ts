import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Internal log buffer to help us debug without terminal access
const logs: string[] = [];
const logger = (msg: string) => {
  const entry = `[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`;
  logs.push(entry);
  if (logs.length > 50) logs.shift();
  console.log(entry);
};

async function startServer() {
  logger("Starting Drawing Server (Master Mode)...");
  
  const app = express();
  const httpServer = createServer(app);
  
  // 1. Socket.io with aggressive polling fallback for mobile
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*" },
    transports: ["polling", "websocket"]
  });

  const rooms: Record<string, any[]> = {};

  // 2. Diagnostic API Routes
  app.get("/api/status", (req, res) => {
    logger(`Status check from ${req.ip}`);
    res.json({ status: "online", rooms: Object.keys(rooms).length });
  });

  app.get("/api/logs", (req, res) => {
    res.json(logs);
  });

  // 3. Socket Logic
  io.on("connection", (socket) => {
    logger(`Socket connected: ${socket.id}`);
    
    socket.on("join-room", (roomId) => {
      logger(`User ${socket.id} joined ${roomId}`);
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
      logger(`Room ${roomId} cleared`);
      rooms[roomId] = [];
      io.to(roomId).emit("canvas-cleared");
    });

    socket.on("disconnect", () => logger(`Socket disconnected: ${socket.id}`));
  });

  // 4. Vite Integration
  logger("Initializing Vite middleware...");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  // 5. Final Port Binding
  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger(`SERVER IS FULLY LIVE ON PORT ${PORT}`);
  });

  process.on("uncaughtException", (err) => logger(`CRITICAL ERROR: ${err.message}`));
}

startServer().catch((err) => logger(`FATAL STARTUP ERROR: ${err.message}`));
