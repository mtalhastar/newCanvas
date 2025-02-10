import React, { useState, Dispatch, SetStateAction } from "react";
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle as CircleIcon,
  Redo,
  RotateCcw,
  ArrowUpRight,
  Star,
  Move,
  Minus,
} from "lucide-react";
import { ToolType } from "@/app/types/canvas";

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: Dispatch<SetStateAction<ToolType>>;
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
  "#CCCCCC", // Gray
];

// Custom triangle icon component
const TriangleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L22 19H2L12 3Z" />
  </svg>
);

// Custom line icon component
const LineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.7734 17.7812L2.22656 2.21875" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Custom arrow icon component
const ArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_2365_1992)">
      <path d="M11 0.281251L15 0.281251C15.1326 0.281251 15.2598 0.333929 15.3536 0.427697C15.4473 0.521466 15.5 0.648643 15.5 0.781251V4.78125C15.5002 4.88027 15.4709 4.97711 15.416 5.0595C15.3611 5.14189 15.2829 5.20612 15.1915 5.24404C15.1 5.28195 14.9993 5.29186 14.9022 5.27249C14.8051 5.25312 14.7159 5.20536 14.646 5.13525L13 3.48825L1.354 15.1353L0.645999 14.4273L12.293 2.78125L10.646 1.13525C10.5759 1.06532 10.5281 0.97615 10.5088 0.879041C10.4894 0.781933 10.4993 0.681261 10.5372 0.589788C10.5751 0.498314 10.6394 0.420159 10.7217 0.365231C10.8041 0.310302 10.901 0.281074 11 0.281251Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0_2365_1992">
        <rect width="15" height="15" fill="white" transform="matrix(-1 0 0 1 15.5 0.28125)"/>
      </clipPath>
    </defs>
  </svg>
);

// Shape icon for main toolbar
const ShapeIcon = () => (
  <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.75 1.45312L20 1.45312L20 12.7031H17.7148L12.666 3.95312L11.6602 5.68164C11.3021 5.12826 10.8757 4.63346 10.3809 4.19727C9.88607 3.76107 9.34245 3.39648 8.75 3.10352V1.45312ZM10.752 7.26367L6.18164 15.1738C5.99284 15.1934 5.80729 15.2031 5.625 15.2031C4.85026 15.2031 4.12109 15.0566 3.4375 14.7637C2.75391 14.4707 2.1582 14.0671 1.65039 13.5527C1.14258 13.0384 0.742188 12.4427 0.449219 11.7656C0.15625 11.0885 0.00651042 10.3594 0 9.57812C0 8.80339 0.146484 8.07422 0.439453 7.39062C0.732422 6.70703 1.13607 6.11133 1.65039 5.60352C2.16471 5.0957 2.76042 4.69531 3.4375 4.40234C4.11458 4.10938 4.84375 3.95964 5.625 3.95312C6.17839 3.95312 6.71224 4.03125 7.22656 4.1875C7.74089 4.34375 8.22266 4.5651 8.67188 4.85156C9.12109 5.13802 9.52148 5.48307 9.87305 5.88672C10.2246 6.29036 10.5176 6.74935 10.752 7.26367ZM5.81055 18.9531L12.666 7.07812L19.5215 18.9531L5.81055 18.9531Z" fill="currentColor" />
  </svg>
);

// Rectangle icon for shapes panel
const RectangleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="14" height="10" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

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
  const [showShapesPanel, setShowShapesPanel] = useState(false);

  // Function to handle shape tool clicks
  const handleShapeClick = (shapeTool: ToolType) => {
    setActiveTool(shapeTool);
    setShowShapesPanel(true);
  };

  const glassStyle =
    "relative z-10 bg-gradient-to-tl from-[#97979766] from-10% to-[#A5A5A500] to-100% bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border border-[#CBCBCB]";
  
  const buttonStyle = "hover:bg-white/20 transition-all duration-300 relative text-[#B0B0B0]";
  const activeButtonStyle = "[&>*]:text-[#2100FF] bg-white/30 shadow-inner";

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 flex gap-3">
      {/* Shapes panel - shown when a shape tool is active */}
      {showShapesPanel && (
        <div className={`${glassStyle} rounded-2xl py-4 px-3 flex flex-col gap-3 relative`}>
          <button
            onClick={() => handleShapeClick("line")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "line" ? activeButtonStyle : ""
            }`}
          >
            <LineIcon />
          </button>
          <button
            onClick={() => handleShapeClick("arrow")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "arrow" ? activeButtonStyle : ""
            }`}
          >
            <ArrowIcon />
          </button>
          <button
            onClick={() => handleShapeClick("star")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "star" ? activeButtonStyle : ""
            }`}
          >
            <Star size={20} />
          </button>
          <button
            onClick={() => handleShapeClick("move")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "move" ? activeButtonStyle : ""
            }`}
          >
            <Move size={20} />
          </button>
          <button
            onClick={() => handleShapeClick("triangle")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "triangle" ? activeButtonStyle : ""
            }`}
          >
            <TriangleIcon />
          </button>
          <button
            onClick={() => handleShapeClick("rectangle")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "rectangle" ? activeButtonStyle : ""
            }`}
          >
            <RectangleIcon />
          </button>
          <button
            onClick={() => handleShapeClick("circle")}
            className={`w-6 h-6 flex items-center justify-center rounded-lg ${buttonStyle} ${
              activeTool === "circle" ? activeButtonStyle : ""
            }`}
          >
            <CircleIcon size={20} />
          </button>
        </div>
      )}

      {/* Color palette - only shown when pen tool is active */}
      {activeTool === "pen" && (
        <div className={`${glassStyle} rounded-2xl p-3 flex flex-col gap-2 relative`}>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setStrokeColor(color)}
              className={`w-6 h-6 rounded-full transition-all duration-300 hover:scale-110 relative ${
                strokeColor === color
                  ? "ring-2 ring-offset-2 ring-white/30"
                  : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <div className="w-6 h-6 border-2 border-white/30 rounded-full flex items-center justify-center">
            <div className="w-3 h-0.5 bg-white/30" />
          </div>
          <div className="w-6 h-6 border-2 border-white/30 rounded-full" />
        </div>
      )}

      {/* Main toolbar */}
      <div className={`${glassStyle} rounded-2xl p-3 flex flex-col gap-4 relative`}>
        <div className="flex flex-col gap-5 items-center relative z-10 py-2">
          <button
            onClick={() => {
              setActiveTool("select");
              setShowShapesPanel(false);
            }}
            className={`p-2 rounded-lg ${buttonStyle} ${
              activeTool === "select" ? activeButtonStyle : ""
            }`}
          >
            <MousePointer2 size={20} />
          </button>
          <button
            onClick={() => {
              setActiveTool("hand");
              setShowShapesPanel(false);
            }}
            className={`p-2 rounded-lg ${buttonStyle} ${
              activeTool === "hand" ? activeButtonStyle : ""
            }`}
          >
            <Hand size={20} />
          </button>
          <button
            onClick={() => {
              setActiveTool("pen");
              setShowShapesPanel(false);
            }}
            className={`p-2 rounded-lg ${buttonStyle} ${
              activeTool === "pen" ? activeButtonStyle : ""
            }`}
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => handleShapeClick("rectangle")}
            className={`p-2 rounded-lg ${buttonStyle} ${
              (showShapesPanel || ["rectangle", "line", "arrow", "star", "move", "triangle", "circle"].includes(activeTool)) ? activeButtonStyle : ""
            }`}
          >
            <ShapeIcon />
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg ${buttonStyle} ${
              !canUndo ? "opacity-20" : ""
            }`}
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg ${buttonStyle} ${
              !canRedo ? "opacity-20" : ""
            }`}
          >
            <Redo size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
