import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { motion } from 'motion/react';

interface LineData {
  id: string;
  tool: string;
  points: number[];
  color: string;
  size: number;
  opacity?: number;
  dash?: number[];
  shadowBlur?: number;
  shadowColor?: string;
}

interface DrawingCanvasProps {
  remoteLines: LineData[];
  onDraw: (line: LineData) => void;
  roomId: string;
  brushColor: string;
  brushSize: number;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onUndoAvailable: (canUndo: boolean) => void;
  onRedoAvailable: (canRedo: boolean) => void;
  undoTrigger: number;
  redoTrigger: number;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  remoteLines,
  onDraw,
  roomId, 
  brushColor, 
  brushSize,
  activeTool,
  setActiveTool,
  onUndoAvailable,
  onRedoAvailable,
  undoTrigger,
  redoTrigger
}) => {
  const [localLines, setLocalLines] = useState<LineData[]>([]);
  const [history, setHistory] = useState<LineData[][]>([]);
  const [redoStack, setRedoStack] = useState<LineData[][]>([]);
  
  // Merge local and remote lines
  const lines = [...remoteLines, ...localLines];
  
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Lasso selection state
  const [lassoPoints, setLassoPoints] = useState<number[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const isLassoing = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    // Firebase handles the state sync now via remoteLines prop
  }, [remoteLines]);

  // Handle Undo/Redo triggers from parent
  useEffect(() => {
    if (undoTrigger > 0) handleUndo();
  }, [undoTrigger]);

  useEffect(() => {
    if (redoTrigger > 0) handleRedo();
  }, [redoTrigger]);

  const saveToHistory = (currentLines: LineData[]) => {
    setHistory(prev => [...prev, [...currentLines]]);
    onUndoAvailable(true);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastState = history[history.length - 1];
    
    setRedoStack(prev => [...prev, [...lines]]);
    setHistory(prev => prev.slice(0, -1));
    setLocalLines(lastState || []);
    
    onUndoAvailable(history.length > 1);
    onRedoAvailable(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    const lineToReAdd = nextState[nextState.length - 1];
    
    if (lineToReAdd && roomId) {
      onDraw(lineToReAdd);
    }

    setHistory(prev => [...prev, [...lines]]);
    setRedoStack(prev => prev.slice(0, -1));
    setLocalLines(nextState);
    
    onUndoAvailable(true);
    onRedoAvailable(redoStack.length > 1);
  };

  const getRelativePointerPosition = (stage: any) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  };

  const handleMouseDown = (e: any) => {
    // If clicking on background, start drawing or lassoing
    if (e.target !== e.target.getStage() && activeTool !== 'lasso') return;

    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);

    if (activeTool === 'lasso') {
      isLassoing.current = true;
      setLassoPoints([pos.x, pos.y]);
      setSelectedLineIds([]);
      return;
    }

    isDrawing.current = true;
    const newLine: LineData = {
      id: Math.random().toString(36).substring(2, 9),
      tool: activeTool,
      points: [pos.x, pos.y],
      color: brushColor,
      size: brushSize,
      opacity: activeTool === 'highlighter' ? 0.3 : 1,
      dash: activeTool === 'dashed' ? [10, 10] : undefined,
      shadowBlur: activeTool === 'neon' ? 15 : 0,
      shadowColor: activeTool === 'neon' ? brushColor : undefined,
    };
    
    setLocalLines(prev => {
      saveToHistory(prev);
      return [...prev, newLine];
    });
    
    setRedoStack([]);
    onRedoAvailable(false);

    // Sync to Firebase
    onDraw(newLine);
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);

    if (isLassoing.current) {
      setLassoPoints(prev => [...prev, pos.x, pos.y]);
      return;
    }

    if (!isDrawing.current) return;

    setLocalLines(prev => {
      const lastLine = { ...prev[prev.length - 1] };
      lastLine.points = lastLine.points.concat([pos.x, pos.y]);
      
      const newLines = [...prev];
      newLines[newLines.length - 1] = lastLine;

      // Sync to Firebase
      onDraw(lastLine);

      return newLines;
    });
  };

  const handleMouseUp = () => {
    if (isLassoing.current) {
      isLassoing.current = false;
      // Simple lasso logic: select lines whose first point is inside the lasso polygon
      const selected = lines.filter(line => {
        const x = line.points[0];
        const y = line.points[1];
        const minX = Math.min(...lassoPoints.filter((_, i) => i % 2 === 0));
        const maxX = Math.max(...lassoPoints.filter((_, i) => i % 2 === 0));
        const minY = Math.min(...lassoPoints.filter((_, i) => i % 2 === 1));
        const maxY = Math.max(...lassoPoints.filter((_, i) => i % 2 === 1));
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      }).map(l => l.id);
      
      setSelectedLineIds(selected);
      setLassoPoints([]);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;
    
    // Final sync
    setLocalLines(prev => {
      const lastLine = prev[prev.length - 1];
      if (lastLine) {
        onDraw(lastLine);
      }
      return prev;
    });
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setStageScale(newScale);
    setStagePos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  const lastDist = useRef(0);
  const lastCenter = useRef<any>(null);

  const handleTouchMove = (e: any) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      // Pinch to zoom logic
      if (isDrawing.current) isDrawing.current = false;
      
      const dist = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) +
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );

      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      if (lastDist.current > 0) {
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const pointTo = {
          x: (center.x - stage.x()) / oldScale,
          y: (center.y - stage.y()) / oldScale,
        };

        const newScale = oldScale * (dist / lastDist.current);
        
        setStageScale(newScale);
        setStagePos({
          x: center.x - pointTo.x * newScale,
          y: center.y - pointTo.y * newScale,
        });
      }

      lastDist.current = dist;
      lastCenter.current = center;
    } else {
      handleMouseMove(e);
    }
  };

  const handleTouchEnd = () => {
    lastDist.current = 0;
    lastCenter.current = null;
    handleMouseUp();
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#fdfaf6] cursor-crosshair overflow-hidden rounded-2xl shadow-inner border border-[#e5e0d8]">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        draggable={activeTool === 'pan'}
        ref={stageRef}
      >
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.size}
              opacity={line.opacity || 1}
              dash={line.dash}
              shadowBlur={line.shadowBlur}
              shadowColor={line.shadowColor}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              draggable={selectedLineIds.includes(line.id)}
              onDragEnd={(e) => {
                const updatedLine = {
                  ...line,
                  points: line.points.map((p, i) => i % 2 === 0 ? p + e.target.x() : p + e.target.y())
                };
                // Reset drag offset
                e.target.x(0);
                e.target.y(0);
                
                if (roomId) {
                  onDraw(updatedLine);
                }
              }}
              globalCompositeOperation={
                line.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
              strokeScaleEnabled={false}
            />
          ))}
          
          {/* Lasso Preview */}
          {lassoPoints.length > 0 && (
            <Line
              points={lassoPoints}
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[5, 5]}
              closed={true}
              fill="rgba(59, 130, 246, 0.1)"
            />
          )}
        </Layer>
      </Stage>
      
      {/* Zoom Indicator */}
      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-mono text-gray-500 border border-gray-200 pointer-events-none">
        {Math.round(stageScale * 100)}%
      </div>
    </div>
  );
};

export default DrawingCanvas;
