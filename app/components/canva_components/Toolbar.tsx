import React, { useState } from "react";
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle as CircleIcon,
  Redo,
  RotateCcw,
  Palette,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ToolType = "select" | "pen" | "rectangle" | "circle" | "hand";

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

const COLORS = [
  "#7C3AED", // Purple
  "#60A5FA", // Blue
  "#34D399", // Green
  "#FBBF24", // Yellow
  "#FB923C", // Orange
  "#F87171", // Red
  "#000000", // Black
];

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
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-lg p-3 flex flex-col gap-4">
      <div className="flex flex-col gap-4 items-center border-b border-gray-200 pb-4">
        <button
          onClick={() => setActiveTool("select")}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            activeTool === "select" ? "bg-blue-100 text-blue-600" : ""
          }`}
        >
          <MousePointer2 size={20} />
        </button>
        <button
          onClick={() => setActiveTool("hand")}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            activeTool === "hand" ? "bg-blue-100 text-blue-600" : ""
          }`}
        >
          <Hand size={20} />
        </button>
        <button
          onClick={() => setActiveTool("pen")}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            activeTool === "pen" ? "bg-blue-100 text-blue-600" : ""
          }`}
        >
          <Pencil size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-3 items-center border-b border-gray-200 pb-4">
        <div className="relative">
          <button
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div
              className="w-5 h-5 rounded-full border border-gray-200"
              style={{ backgroundColor: strokeColor }}
            />
            {isColorPickerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {isColorPickerOpen && (
            <div className="absolute right-full mr-2 bg-white rounded-lg shadow-lg p-2 flex flex-col gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setStrokeColor(color);
                    setIsColorPickerOpen(false);
                  }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    strokeColor === color
                      ? "scale-125 ring-2 ring-offset-2 ring-blue-500"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
        
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-6 h-24 -rotate-180"
          style={{ writingMode: "vertical-lr" }}
        />
      </div>

      <div className="flex flex-col gap-4 items-center">
        <button
          onClick={() => setActiveTool("rectangle")}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            activeTool === "rectangle" ? "bg-blue-100 text-blue-600" : ""
          }`}
        >
          <Square size={20} />
        </button>
        <button
          onClick={() => setActiveTool("circle")}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            activeTool === "circle" ? "bg-blue-100 text-blue-600" : ""
          }`}
        >
          <CircleIcon size={20} />
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            !canUndo ? "opacity-50" : ""
          }`}
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
            !canRedo ? "opacity-50" : ""
          }`}
        >
          <Redo size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
