import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { Server } from 'socket.io';

// Custom plugin to attach Socket.io to the Vite dev server
const socketPlugin = () => ({
  name: 'socket-io-plugin',
  configureServer(server: any) {
    const io = new Server(server.httpServer, {
      path: '/socket.io/',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    const rooms: Record<string, any[]> = {};

    io.on('connection', (socket) => {
      socket.on('join-room', (roomId) => {
        socket.join(roomId);
        const state = rooms[roomId] || [];
        socket.emit('canvas-state', state);
      });

      socket.on('draw', (data) => {
        const { roomId, line } = data;
        if (!rooms[roomId]) rooms[roomId] = [];
        const existingIndex = rooms[roomId].findIndex((l: any) => l.id === line.id);
        if (existingIndex !== -1) {
          rooms[roomId][existingIndex] = line;
        } else {
          rooms[roomId].push(line);
        }
        socket.to(roomId).emit('draw-update', line);
      });

      socket.on('undo', (data) => {
        const { roomId, lineId } = data;
        if (rooms[roomId]) {
          rooms[roomId] = rooms[roomId].filter((l: any) => l.id !== lineId);
          io.to(roomId).emit('line-removed', lineId);
        }
      });

      socket.on('clear-canvas', (roomId) => {
        rooms[roomId] = [];
        io.to(roomId).emit('canvas-cleared');
      });
    });

    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url.startsWith('/api/health')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', msg: 'Vite Plugin Server is Online' }));
        return;
      }
      next();
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), socketPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
