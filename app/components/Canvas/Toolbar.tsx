import React from 'react';
import {
  Pointer as TextSelection,
  PenTool,
  Square,
  Circle as CircleIcon,
  Undo,
  Redo,
} from "lucide-react";

type ToolType = "select" | "pen" | "rectangle" | "circle";

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  return (
    <div
      className="absolute bottom-5 left-[30%] right-[30%] bg-white p-3 rounded-lg shadow-md flex justify-between items-center gap-5"
    >
      <button onClick={() => setActiveTool("select")}>
        <TextSelection
          color={activeTool === "select" ? "blue" : "black"}
          size={24}
        />
      </button>
      <button onClick={() => setActiveTool("pen")}>
        <PenTool color={activeTool === "pen" ? "blue" : "black"} size={24} />
      </button>
      <button onClick={() => setActiveTool("rectangle")}>
        <Square
          color={activeTool === "rectangle" ? "blue" : "black"}
          size={24}
        />
      </button>
      <button onClick={() => setActiveTool("circle")}>
        <CircleIcon
          color={activeTool === "circle" ? "blue" : "black"}
          size={24}
        />
      </button>
      <input
        type="color"
        value={strokeColor}
        onChange={(e) => setStrokeColor(e.target.value)}
        className="w-8 h-8 border-none rounded-full cursor-pointer shadow-md"
      />
      <input
        type="range"
        min="1"
        max="20"
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        className="w-24"
      />
      <button onClick={onUndo} disabled={!canUndo}>
        <Undo color={canUndo ? "black" : "gray"} size={24} />
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        <Redo color={canRedo ? "black" : "gray"} size={24} />
      </button>
    </div>
  );
};

export default Toolbar; 