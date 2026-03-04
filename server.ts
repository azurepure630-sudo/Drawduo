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
  
  // 1. Initialize Socket.io with the most compatible settings
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*" },
    transports: ["polling", "websocket"]
  });

  const PORT = 3000;
  const rooms: Record<string, any[]> = {};

  // 2. API Routes - MUST come before Vite middleware
  app.get("/api/status", (req, res) => {
    res.json({ status: "online", rooms: Object.keys(rooms).length });
  });

  // 3. Socket Logic
  io.on("connection", (socket) => {
    console.log(`[Server] Connected: ${socket.id}`);
    
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

  // 4. Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  // 5. Start Listening
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER LIVE ON PORT ${PORT} <<<`);
  });

  // Error handling to prevent silent crashes
  process.on("uncaughtException", (err) => console.error("CRITICAL ERROR:", err));
}

startServer().catch(err => console.error("SERVER STARTUP FAILED:", err));
