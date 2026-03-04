import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  // 1. HARD CLAIM: Bind to the port IMMEDIATELY to stop 404s
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n>>> PORT ${PORT} CLAIMED - SERVER IS ONLINE <<<\n`);
  });

  // 2. Socket.io with aggressive polling for mobile compatibility
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*" },
    transports: ["polling", "websocket"]
  });

  const rooms: Record<string, any[]> = {};

  // 3. Guaranteed Status Route
  app.get("/api/status", (req, res) => {
    res.json({ status: "online", time: new Date().toISOString() });
  });

  app.get("/api/logs", (req, res) => {
    res.json(["Server is running", `Active rooms: ${Object.keys(rooms).length}`]);
  });

  // 4. Socket Logic
  io.on("connection", (socket) => {
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

  // 5. Load Vite last (it's the heaviest part)
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  process.on("uncaughtException", (err) => console.error("CRITICAL:", err.message));
}

startServer().catch(err => console.error("STARTUP FAILED:", err));
