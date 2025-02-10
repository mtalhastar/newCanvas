export interface CanvasImage {
  id: string;
  url: string;
  x: number;
  y: number;
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface Shape {
  id: string;
  type: "rectangle" | "circle" | "line" | "arrow" | "star" | "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[];  // For line, arrow, and star
  color: string;
  strokeWidth: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
}

export type ToolType = "select" | "pen" | "rectangle" | "circle"; 