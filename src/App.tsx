import React, { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import DrawingCanvas from './components/DrawingCanvas';
import Toolbar from './components/Toolbar';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Users, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

const generateRoomId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [brushColor, setBrushColor] = useState('#1a1a1a');
  const [brushSize, setBrushSize] = useState(5);
  const [activeTool, setActiveTool] = useState('pen');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Undo/Redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);

  useEffect(() => {
    // Initialize room from URL or generate new one
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room') || generateRoomId();
    setRoomId(id);
    
    // Update URL without refreshing
    if (!params.get('room')) {
      window.history.replaceState({}, '', `?room=${id}`);
    }

    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoin = useCallback(() => {
    if (socket && roomId) {
      setIsJoined(true);
    }
  }, [socket, roomId]);

  const handleClear = useCallback(() => {
    if (socket && roomId) {
      socket.emit('clear-canvas', roomId);
    }
  }, [socket, roomId]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans selection:bg-rose-100 selection:text-rose-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {!isJoined ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 flex items-center justify-center p-6 z-50 bg-[#f5f2ed]"
          >
            <div className="max-w-md w-full text-center space-y-8">
              <div className="space-y-4">
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="inline-block p-4 bg-rose-50 rounded-3xl"
                >
                  <Heart className="w-12 h-12 text-rose-500 fill-rose-500" />
                </motion.div>
                <h1 className="text-5xl font-serif italic tracking-tight">DuoDraw</h1>
                <p className="text-gray-500 text-lg">
                  A shared canvas for you and your favorite person.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-rose-100 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-gray-400">Room ID</label>
                    <div className="text-2xl font-mono tracking-wider text-rose-600 bg-rose-50/50 py-3 rounded-xl border border-rose-100">
                      {roomId}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleJoin}
                    className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-medium hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2"
                  >
                    <Users size={20} />
                    Start Drawing Together
                  </button>
                </div>
                
                <p className="text-xs text-gray-400 italic">
                  Share the link with your partner to draw in real-time.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-screen flex flex-col p-4 md:p-8"
          >
            {/* Header */}
            <header className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <Heart size={20} className="text-rose-500 fill-rose-500" />
                </div>
                <div>
                  <h2 className="font-serif italic text-xl">DuoDraw</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Room: {roomId}</p>
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Invite Partner'}
                </button>
              </div>
            </header>

            {/* Main Canvas Area */}
            <main className="flex-1 relative">
              <DrawingCanvas
                socket={socket}
                roomId={roomId}
                brushColor={brushColor}
                brushSize={brushSize}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onUndoAvailable={setCanUndo}
                onRedoAvailable={setCanRedo}
                undoTrigger={undoTrigger}
                redoTrigger={redoTrigger}
              />
            </main>

            {/* Floating Toolbar */}
            <Toolbar
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              onClear={handleClear}
              onShare={handleShare}
              onUndo={() => setUndoTrigger(prev => prev + 1)}
              onRedo={() => setRedoTrigger(prev => prev + 1)}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>
    </div>
  );
}
