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
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  // API routes go here
  app.get(["/api/health", "/api/health/"], (req, res) => {
    console.log(`[Server] Health check from ${req.ip}`);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ 
      status: "ok", 
      env: process.env.NODE_ENV || 'development',
      time: new Date().toISOString() 
    }));
  });

  // Store canvas state per room
  // In a real app, this would be in a database
  const rooms: Record<string, any[]> = {};

  io.on("connection", (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on("join-room", (roomId: string) => {
      if (!roomId) {
        console.log(`[Socket] User ${socket.id} tried to join with empty roomId`);
        return;
      }
      socket.join(roomId);
      console.log(`[Socket] User ${socket.id} joined room: ${roomId}`);
      
      // Send current room state to the new user
      const state = rooms[roomId] || [];
      console.log(`[Socket] Sending state (${state.length} lines) to ${socket.id}`);
      socket.emit("canvas-state", state);
    });

    socket.on("draw", (data: { roomId: string; line: any }) => {
      const { roomId, line } = data;
      if (!roomId || !line) return;
      
      if (!rooms[roomId]) rooms[roomId] = [];
      
      // If the line has an ID, check if we're updating an existing one
      const existingIndex = rooms[roomId].findIndex(l => l.id === line.id);
      if (existingIndex !== -1) {
        rooms[roomId][existingIndex] = line;
      } else {
        rooms[roomId].push(line);
      }
      
      // Broadcast to others in the room
      socket.to(roomId).emit("draw-update", line);
    });

    socket.on("undo", (data: { roomId: string; lineId: string }) => {
      const { roomId, lineId } = data;
      if (roomId && rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(l => l.id !== lineId);
        io.to(roomId).emit("line-removed", lineId);
      }
    });

    socket.on("ping-server", () => {
      socket.emit("pong-client");
    });

    socket.on("clear-canvas", (roomId: string) => {
      rooms[roomId] = [];
      io.to(roomId).emit("canvas-cleared");
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
