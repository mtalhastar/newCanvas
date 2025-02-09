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
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
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