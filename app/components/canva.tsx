"use client";
import { Stage, Layer, Circle, Image, Group, Rect, Line } from "react-konva";
import type Konva from "konva";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Pointer as TextSelection,
  PenTool,
  Square,
  Circle as CircleIcon,
  Undo,
  Redo,
} from "lucide-react";
import useImage from "use-image";
import { KonvaEventObject } from "konva/lib/Node";
import React from "react";

const GRID_SIZE = 50;
const INITIAL_SCALE = 1;
const INITIAL_DIMENSIONS = {
  width: 1000, // default width
  height: 800, // default height
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_FACTOR = 1.06;

// Update constants at top
const IMAGE_GAP = 1000; // Increased gap between images
const GRID_COLUMNS = 3;
const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 200;

// Add state persistence utils
const STORAGE_KEY = "canvas_state";

const saveToLocalStorage = (state: {
  images: CanvasImage[];
  shapes: Shape[];
  lines: any[];
  viewport: ViewportState;
}) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// Add debounced save function
const debouncedSave = debounce((state: any) => {
  saveToLocalStorage(state);
}, 1000);

interface CanvasState {
  images: CanvasImage[];
  shapes: Shape[];
  lines: any[];
  viewport: ViewportState;
}

interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

const imageUrls = [
  "https://xfigurabucket.s3.us-east-1.amazonaws.com/_a_hyper_realistic_rendering_of_an_organically_shaped_house_with_a_curved_marble_exterior__set_against_a_white_background__in_the_style_of_architectural_drawings__flux-dev-lora_1x1_46748.png",
  "https://xfigurabucket.s3.us-east-1.amazonaws.com/A+crazy+man+with+bla_-1.png",
  "https://xfigurabucket.s3.us-east-1.amazonaws.com/a_an_organic_villa_next_to_the_sea_at_the_base_and_a_futuristic_design_aesthetic__hyper_realistic_photograph_ideogram-v2_1x1_664320.png",
];

// Add to interfaces
interface DraggableImageProps {
  id: string;
  url: string;
  x: number;
  y: number;
  isSelected: boolean;
  selectedIds: string[];
  onGroupDrag: (deltaX: number, deltaY: number) => void;
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
  onDelete: () => void;
}

// New state for group dragging

// Add to interface section
interface Shape {
  id: string;
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

// Update DraggableImage component
const DraggableImage = ({
  id,
  url,
  x,
  y,
  isSelected,
  selectedIds,
  onGroupDrag,
  onClick,
}: DraggableImageProps) => {
  const [image] = useImage(url);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  return (
    <React.Fragment>
      <Image
        image={image}
        x={x}
        y={y}
        draggable
        onClick={onClick}
        onDragStart={(e) => {
          setDragStart({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onDragMove={(e) => {
          if (isSelected && selectedIds.length > 1) {
            const deltaX = e.target.x() - dragStart.x;
            const deltaY = e.target.y() - dragStart.y;
            onGroupDrag(deltaX, deltaY);
          }
        }}
      />
      {isSelected && (
        <Rect
          x={x - 2}
          y={y - 2}
          width={image?.width || 0 + 4}
          height={image?.height || 0 + 4}
          stroke="#0096FF"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
    </React.Fragment>
  );
};

// Add performance utilities
const THROTTLE_TIME = 16; // ~60fps

// Helper functions outside component
const calculateScale = (oldScale: number, delta: number) => {
  const scaleBy = 1.06;
  return delta < 0 ? oldScale * scaleBy : oldScale / scaleBy;
};

const limitScale = (scale: number) => {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
};

interface CanvasImage {
  id: string;
  url: string;
  x: number;
  y: number;
}

interface DragEvents {
  dragover: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Add CanvasControls component
const CanvasControls = ({
  onZoomIn,
  onZoomOut,
  onPan,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPan: (dx: number, dy: number) => void;
}) => {
  const PAN_AMOUNT = 50;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "white",
        padding: "10px",
        borderRadius: "4px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          onClick={onZoomIn}
          style={{ padding: "4px 8px", cursor: "pointer" }}
        >
          +
        </button>
        <button
          onClick={onZoomOut}
          style={{ padding: "4px 8px", cursor: "pointer" }}
        >
          -
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "4px",
        }}
      >
        <button
          style={{ padding: "4px 8px", cursor: "pointer" }}
          onClick={() => onPan(PAN_AMOUNT, 0)}
        >
          ←
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            style={{ padding: "4px 8px", cursor: "pointer" }}
            onClick={() => onPan(0, PAN_AMOUNT)}
          >
            ↑
          </button>

          <button
            style={{ padding: "4px 8px", cursor: "pointer" }}
            onClick={() => onPan(0, -PAN_AMOUNT)}
          >
            ↓
          </button>
        </div>
        <button
          onClick={() => onPan(-PAN_AMOUNT, 0)}
          style={{ padding: "4px 8px", cursor: "pointer" }}
        >
          →
        </button>
      </div>
    </div>
  );
};

// Add tool types
type ToolType = "select" | "pen" | "rectangle" | "circle";

// Add toolbar component
const Toolbar = ({
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
}: {
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
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "40%",
        right: "30%",
        background: "white",
        padding: "10px",
        borderRadius: "4px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "flex",
        justifyContent: "space-between",
        flexDirection: "row",
        gap: "20px",
      }}
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
        style={{
          width: "32px",
          height: "32px",
          border: "none",
          borderRadius: "50%",
          padding: "0",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
        }}
      />
      <input
        type="range"
        min="1"
        max="20"
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        
      />
      <button onClick={onUndo} disabled={!canUndo}>
        <Undo color={canUndo ? "black" : "gray"} size={24} />
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        <Redo color={canUndo ? "black" : "gray"} size={24} />
      </button>
    </div>
  );
};

// Add handlers to main component
const Canva = () => {
  // 1. All state hooks
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: INITIAL_SCALE,
  });
  const [stageDimensions, setStageDimensions] = useState(INITIAL_DIMENSIONS);
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  // Add to existing state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);

  // Add states for drawing
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [lines, setLines] = useState<any[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const isDrawing = useRef(false);

  // 2. All ref hooks
  const stageRef = useRef<Konva.Stage>(null);
  const gridLayerRef = useRef<Konva.Layer>(null);
  const rafRef = useRef<number | null>(null);
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const groupDragStartPos = useRef({ x: 0, y: 0 });
  const initialGroupPositions = useRef<
    Record<string, { x: number; y: number }>
  >({});

  // 3. All callback hooks - define ALL of them here
  const updateViewport = useCallback((newViewport: ViewportState) => {
    setViewport(newViewport);
  }, []);

  // This code block was intentionally removed as it was duplicated

  const [history, setHistory] = useState<CanvasState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const stateRef = useRef<CanvasState>({
    images: [],
    shapes: [],
    lines: [],
    viewport: { x: 0, y: 0, scale: INITIAL_SCALE },
  });

  const handleDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      updateViewport({
        ...viewport,
        x: stage.x(),
        y: stage.y(),
      });
    },
    [viewport, updateViewport]
  );

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const stagePos = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };

    // Handle both files and URLs
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      // Handle file drops
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.type.match(/^image\/(jpeg|png|gif|bmp|svg\+xml)$/)) {
          const objectUrl = URL.createObjectURL(file);
          setObjectUrls((prev) => [...prev, objectUrl]);
          setImages((prev) => [
            ...prev,
            {
              id: `image-${Date.now()}`,
              url: objectUrl,
              x: stagePos.x,
              y: stagePos.y,
            },
          ]);
        }
      });
    } else if (e.dataTransfer?.getData("text").startsWith("file:///")) {
      // Handle local file URLs
      const fileUrl = e.dataTransfer.getData("text");
      const localPath = decodeURI(fileUrl.replace("file:///", ""));

      // Create a File object from local path
      fetch(fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          setObjectUrls((prev) => [...prev, objectUrl]);
          setImages((prev) => [
            ...prev,
            {
              id: `image-${Date.now()}`,
              url: objectUrl,
              x: stagePos.x,
              y: stagePos.y,
            },
          ]);
        });
    }
  }, []);

  // Add to callback hooks
  const handleImageDelete = useCallback(() => {
    if (selectedId) {
      setImages((prev) => prev.filter((img) => img.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId]);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      if (activeTool === "select") {
        const target = e.target;
        const targetId = target.id();
        const isSelected = selectedIds.includes(targetId);

        // Start group drag if clicking on a selected item
        if (isSelected && selectedIds.length > 1) {
          const pos = stage.getPointerPosition();
          if (pos) {
            groupDragStartPos.current = { x: pos.x, y: pos.y };

            // Store initial positions of all selected items
            const positions: Record<string, { x: number; y: number }> = {};

            // For images
            images.forEach((img) => {
              if (selectedIds.includes(img.id)) {
                positions[img.id] = { x: img.x, y: img.y };
              }
            });

            // For shapes
            shapes.forEach((shape) => {
              if (selectedIds.includes(shape.id)) {
                positions[shape.id] = { x: shape.x, y: shape.y };
              }
            });

            initialGroupPositions.current = positions;
            setIsGroupDragging(true);
          }
          return;
        }

        const clickedOnEmpty = target === stage;
        if (clickedOnEmpty) {
          if (!e.evt.shiftKey) setSelectedIds([]);
          setIsSelecting(true);
          const pos = stage.getPointerPosition();
          if (!pos) return;
          selectionStart.current = {
            x: (pos.x - stage.x()) / stage.scaleX(),
            y: (pos.y - stage.y()) / stage.scaleY(),
          };
        }
      } else {
        // Drawing tools
        isDrawing.current = true;
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const stagePos = {
          x: (pos.x - stage.x()) / stage.scaleX(),
          y: (pos.y - stage.y()) / stage.scaleY(),
        };

        if (activeTool === "pen") {
          setLines([
            ...lines,
            {
              points: [stagePos.x, stagePos.y],
              color: strokeColor,
              width: strokeWidth,
            },
          ]);
        } else {
          setShapes([
            ...shapes,
            {
              id: `shape-${Date.now()}`,
              type: activeTool,
              x: stagePos.x,
              y: stagePos.y,
              width: 0,
              height: 0,
              color: strokeColor,
              strokeWidth,
            },
          ]);
        }
      }
    },
    [activeTool, strokeColor, strokeWidth, lines, shapes]
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Handle group dragging of selected items
      if (isGroupDragging) {
        const pos = stage.getPointerPosition();
        if (pos && initialGroupPositions.current) {
          // Convert pointer movement to stage coordinates (considering zoom level)
          const deltaX = (pos.x - groupDragStartPos.current.x) / viewport.scale;
          const deltaY = (pos.y - groupDragStartPos.current.y) / viewport.scale;

          // Update images positions
          setImages((prevImages) =>
            prevImages.map((img) => {
              if (selectedIds.includes(img.id)) {
                const initial = initialGroupPositions.current[img.id];
                return {
                  ...img,
                  x: initial.x + deltaX,
                  y: initial.y + deltaY,
                };
              }
              return img;
            })
          );

          // Update shapes positions
          setShapes((prevShapes) =>
            prevShapes.map((shape) => {
              if (selectedIds.includes(shape.id)) {
                const initial = initialGroupPositions.current[shape.id];
                return {
                  ...shape,
                  x: initial.x + deltaX,
                  y: initial.y + deltaY,
                };
              }
              return shape;
            })
          );
        }
      }
      // Handle selection rectangle
      else if (isSelecting && selectionStart.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Convert pointer position to stage coordinates (relative to viewport)
        const stageX = (pos.x - stage.x()) / stage.scaleX();
        const stageY = (pos.y - stage.y()) / stage.scaleY();

        // Calculate selection rectangle dimensions
        const rect = {
          x: Math.min(selectionStart.current.x, stageX),
          y: Math.min(selectionStart.current.y, stageY),
          width: Math.abs(stageX - selectionStart.current.x),
          height: Math.abs(stageY - selectionStart.current.y),
        };
        setSelectionRect(rect);

        // Find intersecting elements
        const newSelectedIds: string[] = [];

        // Check image intersections
        images.forEach((img) => {
          const imgRight = img.x + IMAGE_WIDTH;
          const imgBottom = img.y + IMAGE_HEIGHT;

          if (
            rect.x < imgRight &&
            rect.x + rect.width > img.x &&
            rect.y < imgBottom &&
            rect.y + rect.height > img.y
          ) {
            newSelectedIds.push(img.id);
          }
        });

        // Check shape intersections
        shapes.forEach((shape) => {
          if (shape.type === "rectangle") {
            // Rectangle-to-rectangle collision
            if (
              rect.x < shape.x + shape.width &&
              rect.x + rect.width > shape.x &&
              rect.y < shape.y + shape.height &&
              rect.y + rect.height > shape.y
            ) {
              newSelectedIds.push(shape.id);
            }
          } else {
            // Circle-to-rectangle collision (approximate with bounding box)
            const radius = Math.abs(shape.width);
            const circleLeft = shape.x - radius;
            const circleRight = shape.x + radius;
            const circleTop = shape.y - radius;
            const circleBottom = shape.y + radius;

            if (
              rect.x < circleRight &&
              rect.x + rect.width > circleLeft &&
              rect.y < circleBottom &&
              rect.y + rect.height > circleTop
            ) {
              newSelectedIds.push(shape.id);
            }
          }
        });

        // Update selection based on shift key
        if (e.evt.shiftKey) {
          setSelectedIds((prev) => [
            ...new Set([...prev, ...newSelectedIds]), // Remove duplicates
          ]);
        } else {
          setSelectedIds(newSelectedIds);
        }
      }
      // Handle drawing tools
      else if (isDrawing.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Convert to stage coordinates considering viewport
        const stagePos = {
          x: (pos.x - stage.x()) / stage.scaleX(),
          y: (pos.y - stage.y()) / stage.scaleY(),
        };

        if (activeTool === "pen") {
          // Update current line
          const lastLine = lines[lines.length - 1];
          lastLine.points = lastLine.points.concat([stagePos.x, stagePos.y]);
          setLines([...lines.slice(0, -1), lastLine]);
        } else if (activeTool === "rectangle" || activeTool === "circle") {
          // Update current shape dimensions
          const lastShape = shapes[shapes.length - 1];
          setShapes([
            ...shapes.slice(0, -1),
            {
              ...lastShape,
              width: stagePos.x - lastShape.x,
              height: stagePos.y - lastShape.y,
            },
          ]);
        }
      }
    },
    [
      activeTool,
      isGroupDragging,
      isSelecting,
      images,
      shapes,
      lines,
      selectedIds,
      viewport.scale,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (activeTool === "select") {
      setIsSelecting(false);
      setSelectionRect(null);
      selectionStart.current = null;
      if (isGroupDragging) {
        addHistoryEntry(stateRef.current);
        setIsGroupDragging(false);
      }
    } else {
      isDrawing.current = false;
      addHistoryEntry(stateRef.current);
    }
  }, [activeTool, isGroupDragging]);

  const lastTouchPositions = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Update the handleWheel function
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      // Handle trackpad pan (two-finger scroll)
      if (!e.evt.ctrlKey) {
        const deltaX = e.evt.deltaX;
        const deltaY = e.evt.deltaY;

        updateViewport({
          ...viewport,
          x: viewport.x - deltaX,
          y: viewport.y - deltaY,
        });
        return;
      }

      // Original zoom handling for ctrl+wheel
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = viewport.scale;
      const newScale =
        e.evt.deltaY > 0
          ? Math.max(oldScale / ZOOM_FACTOR, MIN_SCALE)
          : Math.min(oldScale * ZOOM_FACTOR, MAX_SCALE);

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      updateViewport({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [viewport, updateViewport]
  );

  // Update renderGrid callback
  const renderGrid = useCallback(() => {
    // Convert stage coordinates to grid space
    const stageX = -viewport.x / viewport.scale;
    const stageY = -viewport.y / viewport.scale;

    // Calculate visible area with padding
    const padding = GRID_SIZE * 10;
    const viewWidth = stageDimensions.width / viewport.scale;
    const viewHeight = stageDimensions.height / viewport.scale;

    // Calculate grid boundaries
    const startX = Math.floor((stageX - padding) / GRID_SIZE) * GRID_SIZE;
    const endX =
      Math.ceil((stageX + viewWidth + padding) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((stageY - padding) / GRID_SIZE) * GRID_SIZE;
    const endY =
      Math.ceil((stageY + viewHeight + padding) / GRID_SIZE) * GRID_SIZE;

    const gridDots = [];

    // Generate grid dots
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      for (let y = startY; y <= endY; y += GRID_SIZE) {
        gridDots.push(
          <Circle
            key={`${x}-${y}`}
            x={x}
            y={y}
            radius={1 / viewport.scale}
            fill="#666"
            opacity={0.5}
            perfectDrawEnabled={false}
            listening={false}
          />
        );
      }
    }
    return gridDots;
  }, [viewport, stageDimensions]);

  useEffect(() => {
    stateRef.current = {
      images,
      shapes,
      lines,
      viewport,
    };
  }, [images, shapes, lines, viewport]);

  const addHistoryEntry = (newState: CanvasState) => {
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory.slice(0, currentIndex + 1), newState];
      return newHistory;
    });
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  // 4. All effect hooks
  useEffect(() => {
    setStageDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setMounted(true);

    const handleResize = () => {
      setStageDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };

      const files = Array.from(e.dataTransfer?.files || []);
      files.forEach((file) => {
        if (file.type.startsWith("image/")) {
          const objectUrl = URL.createObjectURL(file);
          setObjectUrls((prev) => [...prev, objectUrl]);
          setImages((prev) => [
            ...prev,
            {
              id: `image-${Date.now()}`,
              url: objectUrl,
              x: stagePos.x,
              y: stagePos.y,
            },
          ]);
        }
      });
    };

    // Add listeners directly to container
    container.addEventListener("dragover", handleDragOver, false);
    container.addEventListener("drop", handleDrop, false);
    container.addEventListener("dragenter", (e) => e.preventDefault(), false);
    container.addEventListener("dragleave", (e) => e.preventDefault(), false);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragenter", (e) => e.preventDefault());
      container.removeEventListener("dragleave", (e) => e.preventDefault());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Add keyboard event effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleImageDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleImageDelete]);

  // Add delete handler
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));
      setSelectedIds([]); // Clear selection after delete
    }
  }, [selectedIds]);

  // Add keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        setImages((prev) =>
          prev.filter((img) => !selectedIds.includes(img.id))
        );
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds]);

  const handleFileDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const stagePos = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };

    const files = Array.from(e.dataTransfer?.files || []);
    files.forEach((file) => {
      // Support all image formats including SVG
      if (file.type.match(/^image\/(jpeg|png|gif|bmp|svg\+xml)$/)) {
        const objectUrl = URL.createObjectURL(file);

        if (file.type === "image/svg+xml") {
          // Handle SVG specifically
          const img = new window.Image();
          img.onload = () => {
            setObjectUrls((prev) => [...prev, objectUrl]);
            setImages((prev) => [
              ...prev,
              {
                id: `image-${Date.now()}`,
                url: objectUrl,
                x: stagePos.x,
                y: stagePos.y,
              },
            ]);
          };
          img.src = objectUrl;
        } else {
          // Handle other image formats
          setObjectUrls((prev) => [...prev, objectUrl]);
          setImages((prev) => [
            ...prev,
            {
              id: `image-${Date.now()}`,
              url: objectUrl,
              x: stagePos.x,
              y: stagePos.y,
            },
          ]);
        }
      }
    });
  }, []);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    container.addEventListener("drop", handleFileDrop);

    return () => {
      container.removeEventListener("dragover", (e) => e.preventDefault());
      container.removeEventListener("drop", handleFileDrop);
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [handleFileDrop, objectUrls]);

  useEffect(() => {
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [objectUrls]);

  // Update initial image loading
  useEffect(() => {
    const loadInitialImages = () => {
      const initialImages = imageUrls.map((url, index) => ({
        id: `image-${index}`,
        url,
        x: (index % GRID_COLUMNS) * (IMAGE_WIDTH + IMAGE_GAP) + IMAGE_GAP,
        y:
          Math.floor(index / GRID_COLUMNS) * (IMAGE_HEIGHT + IMAGE_GAP) +
          IMAGE_GAP,
      }));
      setImages(initialImages);
    };

    loadInitialImages();
  }, []); // Empty dependency array means this runs once on mount

  // Add to main Canvas component
  const handleGroupDrag = useCallback(
    (deltaX: number, deltaY: number) => {
      setImages((prev) =>
        prev.map((img) => {
          if (selectedIds.includes(img.id)) {
            return {
              ...img,
              x: img.x + deltaX,
              y: img.y + deltaY,
            };
          }
          return img;
        })
      );
    },
    [selectedIds]
  );

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(viewport.scale * ZOOM_FACTOR, MAX_SCALE);
    const newState = {
      ...stateRef.current,
      viewport: { ...viewport, scale: newScale },
    };
    addHistoryEntry(newState);
    updateViewport(newState.viewport);
  }, [viewport, updateViewport]);

  const handleZoomOut = useCallback(() => {
    updateViewport({
      ...viewport,
      scale: Math.max(viewport.scale / ZOOM_FACTOR, MIN_SCALE),
    });
  }, [viewport, updateViewport]);

  const handlePan = useCallback(
    (dx: number, dy: number) => {
      updateViewport({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
    },
    [viewport, updateViewport]
  );

  // Add delete handler
  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      const newImages = images.filter((img) => !selectedIds.includes(img.id));
      const newShapes = shapes.filter(
        (shape) => !selectedIds.includes(shape.id)
      );
      const newState = {
        images: newImages,
        shapes: newShapes,
        lines: lines,
        viewport: viewport,
      };
      addHistoryEntry(newState);
      setImages(newImages);
      setShapes(newShapes);
      setSelectedIds([]);
    }
  }, [selectedIds, images, shapes, lines, viewport]);

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDelete]);

  // Add to useEffect for loading saved state
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const { images, shapes, lines, viewport } = JSON.parse(savedState);
      setImages(images);
      setShapes(shapes);
      setLines(lines);
      updateViewport(viewport);
      setHistory([{ images, shapes, lines, viewport }]);
      setCurrentIndex(0);
    } else {
      const initialImages = imageUrls.map((url, index) => ({
        id: `image-${index}`,
        url,
        x: (index % GRID_COLUMNS) * (IMAGE_WIDTH + IMAGE_GAP) + IMAGE_GAP,
        y:
          Math.floor(index / GRID_COLUMNS) * (IMAGE_HEIGHT + IMAGE_GAP) +
          IMAGE_GAP,
      }));
      const initialState = {
        images: initialImages,
        shapes: [],
        lines: [],
        viewport: { x: 0, y: 0, scale: INITIAL_SCALE },
      };
      setImages(initialImages);
      setHistory([initialState]);
      setCurrentIndex(0);
    }
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      const newIndex = currentIndex - 1;
      const state = history[newIndex];
      setImages(state.images);
      setShapes(state.shapes);
      setLines(state.lines);
      updateViewport(state.viewport);
      setCurrentIndex(newIndex);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      const newIndex = currentIndex + 1;
      const state = history[newIndex];
      setImages(state.images);
      setShapes(state.shapes);
      setLines(state.lines);
      updateViewport(state.viewport);
      setCurrentIndex(newIndex);
    }
  };

  // Add state change listener
  useEffect(() => {
    const currentState = {
      images,
      shapes,
      lines,
      viewport,
    };
    debouncedSave(currentState);
  }, [images, shapes, lines, viewport]);

  // Add drag handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileOrUrlDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Convert to stage coordinates considering viewport transform
      const stagePos = {
        x: (pos.x - viewport.x) / viewport.scale,
        y: (pos.y - viewport.y) / viewport.scale,
      };

      // Create state update after handling the drop
      const newState = {
        images: stateRef.current.images,
        shapes: stateRef.current.shapes,
        lines: stateRef.current.lines,
        viewport: stateRef.current.viewport,
      };
      addHistoryEntry(newState);

      // Handle File Drops
      if (e.dataTransfer?.files?.length) {
        Array.from(e.dataTransfer.files).forEach((file) => {
          if (file.type.startsWith("image/")) {
            const objectUrl = URL.createObjectURL(file);
            setImages((prev) => [
              ...prev,
              {
                id: `image-${Date.now()}`,
                url: objectUrl,
                x: stagePos.x,
                y: stagePos.y,
              },
            ]);
            setObjectUrls((prev) => [...prev, objectUrl]);
          }
        });
      }

      // Handle URL drops (both network and local files)
      else {
        // Try different data types for URL extraction
        const url =
          e.dataTransfer?.getData("URL") ||
          e.dataTransfer?.getData("text/uri-list") ||
          e.dataTransfer?.getData("text");

        if (url) {
          // Handle local file paths (file://)
          if (url.startsWith("file://")) {
            fetch(url)
              .then((res) => res.blob())
              .then((blob) => {
                const objectUrl = URL.createObjectURL(blob);
                setImages((prev) => [
                  ...prev,
                  {
                    id: `image-${Date.now()}`,
                    url: objectUrl,
                    x: stagePos.x,
                    y: stagePos.y,
                  },
                ]);
                setObjectUrls((prev) => [...prev, objectUrl]);
              });
          }
          // Handle network URLs
          else if (url.startsWith("http")) {
            setImages((prev) => [
              ...prev,
              {
                id: `image-${Date.now()}`,
                url: url,
                x: stagePos.x,
                y: stagePos.y,
              },
            ]);
          }
        }
      }
    },
    [viewport.x, viewport.y, viewport.scale]
  );

  // Update event listeners
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    const handleDrag = (e: DragEvent) => e.preventDefault();

    container.addEventListener("dragover", handleDrag);
    container.addEventListener("dragenter", handleDrag);
    container.addEventListener("drop", (e) => handleFileOrUrlDrop(e));

    return () => {
      container.removeEventListener("dragover", handleDrag);
      container.removeEventListener("dragenter", handleDrag);
      container.removeEventListener("drop", (e) => handleFileOrUrlDrop(e));
    };
  }, [handleFileOrUrlDrop]);

  if (!mounted) {
    return null; // or loading state
  }

  return (
    <div style={{ position: "relative" }}>
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        draggable={activeTool === "select" && !isSelecting} // Only allow drag in select mode
        onWheel={handleWheel}
        x={viewport.x}
        y={viewport.y}
        scale={{ x: viewport.scale, y: viewport.scale }}
        onTouchStart={(e) => {
          const touches = e.evt.touches;
          if (touches.length === 2) {
            e.evt.preventDefault();
            lastTouchPositions.current = {
              x1: touches[0].clientX,
              y1: touches[0].clientY,
              x2: touches[1].clientX,
              y2: touches[1].clientY,
            };
          }
        }}
        onTouchMove={(e) => {
          const touches = e.evt.touches;
          if (touches.length === 2 && lastTouchPositions.current) {
            e.evt.preventDefault();

            // Calculate movement delta
            const currentX1 = touches[0].clientX;
            const currentY1 = touches[0].clientY;
            const currentX2 = touches[1].clientX;
            const currentY2 = touches[1].clientY;

            // Calculate previous and current center points
            const prevCenter = {
              x:
                (lastTouchPositions.current.x1 +
                  lastTouchPositions.current.x2) /
                2,
              y:
                (lastTouchPositions.current.y1 +
                  lastTouchPositions.current.y2) /
                2,
            };
            const currentCenter = {
              x: (currentX1 + currentX2) / 2,
              y: (currentY1 + currentY2) / 2,
            };

            // Update viewport position
            updateViewport({
              ...viewport,
              x: viewport.x + (currentCenter.x - prevCenter.x),
              y: viewport.y + (currentCenter.y - prevCenter.y),
            });

            // Update touch positions
            lastTouchPositions.current = {
              x1: currentX1,
              y1: currentY1,
              x2: currentX2,
              y2: currentY2,
            };
          }
        }}
        onTouchEnd={() => {
          lastTouchPositions.current = null;
        }}
        onClick={(e) => {
          // Deselect when clicking on stage
          const clickedOnEmpty = e.target === e.target.getStage();
          if (clickedOnEmpty) {
            setSelectedId(null);
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragMove={handleDragMove}
        onDragEnd={handleDragMove}
      >
        <Layer ref={gridLayerRef} listening={false}>
          <Group>{renderGrid()}</Group>
        </Layer>
        <Layer>
          {images.map((img) => (
            <DraggableImage
              key={img.id}
              id={img.id}
              url={img.url}
              x={img.x}
              y={img.y}
              isSelected={selectedIds.includes(img.id)}
              selectedIds={selectedIds}
              onGroupDrag={handleGroupDrag}
              onClick={(e) => {
                e.evt.stopPropagation();
                const isShiftPressed = e.evt.shiftKey;
                if (isShiftPressed) {
                  setSelectedIds((prev) =>
                    prev.includes(img.id)
                      ? prev.filter((id) => id !== img.id)
                      : [...prev, img.id]
                  );
                } else {
                  setSelectedIds([img.id]);
                }
              }}
              onDelete={() => handleImageDelete()}
            />
          ))}
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(0,0,255,0.1)"
              stroke="#0096FF"
            />
          )}
        </Layer>
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.width}
              tension={0.5}
              lineCap="round"
            />
          ))}
          {shapes.map((shape) => {
            const isSelected = selectedIds.includes(shape.id);
            if (shape.type === "rectangle") {
              return (
                <React.Fragment key={shape.id}>
                  <Rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    onClick={(e) => {
                      if (!e.evt.shiftKey) setSelectedIds([]);
                      setSelectedIds((prev) => [...prev, shape.id]);
                    }}
                  />
                  {isSelected && (
                    <Rect
                      x={shape.x - 2}
                      y={shape.y - 2}
                      width={shape.width + 4}
                      height={shape.height + 4}
                      stroke="#0096FF"
                      strokeWidth={2}
                      dash={[5, 5]}
                    />
                  )}
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={shape.id}>
                <Circle
                  x={shape.x}
                  y={shape.y}
                  radius={Math.abs(shape.width)}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                  onClick={(e) => {
                    if (!e.evt.shiftKey) setSelectedIds([]);
                    setSelectedIds((prev) => [...prev, shape.id]);
                  }}
                />
                {isSelected && (
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={Math.abs(shape.width) + 2}
                    stroke="#0096FF"
                    strokeWidth={2}
                    dash={[5, 5]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
      <CanvasControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onPan={handlePan}
      />
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
    </div>
  );
};

// Add debounce utility
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default Canva;
