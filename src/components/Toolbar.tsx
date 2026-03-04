import React from 'react';
import { 
  Palette, 
  MousePointer2, 
  Eraser, 
  Trash2, 
  Share2, 
  Undo2, 
  Redo2, 
  Highlighter, 
  Sparkles, 
  Move, 
  Scissors,
  Minus
} from 'lucide-react';
import { motion } from 'motion/react';

interface ToolbarProps {
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onClear: () => void;
  onShare: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const colors = [
  '#1a1a1a', // Black
  '#4a4a4a', // Gray
  '#e63946', // Red
  '#ff4d6d', // Rose
  '#f4a261', // Orange
  '#e9c46a', // Yellow
  '#2a9d8f', // Teal
  '#457b9d', // Blue
  '#8338ec', // Purple
  '#ff006e', // Pink
  '#3a5a40', // Forest
  '#606c38', // Olive
];

const tools = [
  { id: 'pen', icon: MousePointer2, label: 'Pen' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
  { id: 'dashed', icon: Minus, label: 'Dashed' },
  { id: 'neon', icon: Sparkles, label: 'Neon' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'lasso', icon: Scissors, label: 'Lasso' },
  { id: 'pan', icon: Move, label: 'Pan' },
];

const Toolbar: React.FC<ToolbarProps> = ({
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  activeTool,
  setActiveTool,
  onClear,
  onShare,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50"
    >
      {/* Main Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-full">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 pr-4 border-r border-gray-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-full transition-colors ${canUndo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-full transition-colors ${canRedo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 pr-4 border-r border-gray-200">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`p-2 rounded-full transition-all ${
                activeTool === tool.id 
                  ? 'bg-gray-900 text-white scale-110 shadow-lg' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={tool.label}
            >
              <tool.icon size={18} />
            </button>
          ))}
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-4 pr-4 border-r border-gray-200">
          <input
            type="range"
            min="1"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-500 rounded-full transition-colors"
            title="Clear Canvas"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={onShare}
            className="p-2 hover:bg-blue-50 text-gray-600 hover:text-blue-500 rounded-full transition-colors"
            title="Share Link"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Color Palette (Floating above) */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-xl rounded-full"
      >
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => setBrushColor(color)}
            className={`w-6 h-6 rounded-full transition-all hover:scale-125 active:scale-95 ${
              brushColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-125 z-10' : 'opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

export default Toolbar;
