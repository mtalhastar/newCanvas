"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  useMemo,
} from "react";
import { Stage, Layer, Circle, Image, Group, Rect, Line } from "react-konva";
import type Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";
import {
  Pointer as TextSelection,
  PenTool,
  Square,
  Circle as CircleIcon,
  Undo,
  Redo,
} from "lucide-react";
import useImage from "use-image";

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function throttle(func: Function, limit: number) {
  let inThrottle: boolean;
  return function (...args: any[]) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

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

// -----------------------------------------------------------------------------
// Constants & Interfaces
// -----------------------------------------------------------------------------

const GRID_SIZE = 50;
const INITIAL_SCALE = 1;
const INITIAL_DIMENSIONS = { width: 1000, height: 800 };
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

const IMAGE_GAP = 1000;
const GRID_COLUMNS = 3;
const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 200;

const STORAGE_KEY = "canvas_state";

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

interface CanvasImage {
  id: string;
  url: string;
  x: number;
  y: number;
}

interface DraggableImageProps {
  id: string;
  url: string;
  x: number;
  y: number;
  isSelected: boolean;
  selectedIds: string[];
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (id: string, newX: number, newY: number) => void;
  onDelete: () => void;
}

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

type ToolType = "select" | "pen" | "rectangle" | "circle";

// -----------------------------------------------------------------------------
// DraggableImage Component
// -----------------------------------------------------------------------------

const DraggableImage = ({
  id,
  url,
  x,
  y,
  isSelected,
  selectedIds,
  onClick,
  onDragEnd,
  onDelete,
}: DraggableImageProps) => {
  const [image] = useImage(url);
  return (
    <>
      {/* Explicitly set the id so that KonvaEventObject.id() returns it */}
      <Image
        id={id}
        image={image}
        x={x}
        y={y}
        draggable={selectedIds.length <= 1}
        onClick={onClick}
        onDragEnd={(e) => onDragEnd(id, e.target.x(), e.target.y())}
        perfectDrawEnabled={false}
      />
      {isSelected && (
        <Rect
          x={x - 2}
          y={y - 2}
          width={(image?.width || 0) + 4}
          height={(image?.height || 0) + 4}
          stroke="#0096FF"
          strokeWidth={2}
          dash={[5, 5]}
          perfectDrawEnabled={false}
        />
      )}
    </>
  );
};

// -----------------------------------------------------------------------------
// CanvasControls Component
// -----------------------------------------------------------------------------

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
          onClick={() => onPan(PAN_AMOUNT, 0)}
          style={{ padding: "4px 8px", cursor: "pointer" }}
        >
          ←
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            onClick={() => onPan(0, PAN_AMOUNT)}
            style={{ padding: "4px 8px", cursor: "pointer" }}
          >
            ↑
          </button>
          <button
            onClick={() => onPan(0, -PAN_AMOUNT)}
            style={{ padding: "4px 8px", cursor: "pointer" }}
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

// -----------------------------------------------------------------------------
// Toolbar Component
// -----------------------------------------------------------------------------

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
        left: "30%",
        right: "30%",
        background: "white",
        padding: "10px",
        borderRadius: "4px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "flex",
        justifyContent: "space-between",
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
        <Redo color={canRedo ? "black" : "gray"} size={24} />
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Canvas Component
// -----------------------------------------------------------------------------

const Canva = () => {
  // Viewport & Stage Dimensions
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: INITIAL_SCALE,
  });
  const [stageDimensions, setStageDimensions] = useState(INITIAL_DIMENSIONS);

  // Images & Shapes State
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [lines, setLines] = useState<any[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const isDrawing = useRef(false);

  // Konva Stage Ref
  const stageRef = useRef<Konva.Stage>(null);

  // History State for Undo/Redo
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const stateRef = useRef<CanvasState>({
    images: [],
    shapes: [],
    lines: [],
    viewport: { x: 0, y: 0, scale: INITIAL_SCALE },
  });

  // ---------------------------------------------------------------------------
  // Compute Group Bounding Box for Selected Items
  // ---------------------------------------------------------------------------
  const groupBBox = useMemo(() => {
    if (selectedIds.length < 2) return null;
    let xs: number[] = [];
    let ys: number[] = [];
    images.forEach((img) => {
      if (selectedIds.includes(img.id)) {
        xs.push(img.x);
        ys.push(img.y);
        xs.push(img.x + IMAGE_WIDTH);
        ys.push(img.y + IMAGE_HEIGHT);
      }
    });
    shapes.forEach((shape) => {
      if (selectedIds.includes(shape.id)) {
        xs.push(shape.x);
        ys.push(shape.y);
        xs.push(shape.x + shape.width);
        ys.push(shape.y + shape.height);
      }
    });
    if (xs.length === 0 || ys.length === 0) return null;
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [images, shapes, selectedIds]);

  // ---------------------------------------------------------------------------
  // Update viewport and history helper functions
  // ---------------------------------------------------------------------------
  const updateViewport = useCallback((newViewport: ViewportState) => {
    setViewport(newViewport);
    if (stageRef.current) {
      stageRef.current.batchDraw();
    }
  }, []);

  useEffect(() => {
    stateRef.current = { images, shapes, lines, viewport };
  }, [images, shapes, lines, viewport]);

  const addHistoryEntry = (newState: CanvasState) => {
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory.slice(0, currentIndex + 1), newState];
      return newHistory;
    });
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  // ---------------------------------------------------------------------------
  // Smooth Zoom (using exponential zoom factor)
  // ---------------------------------------------------------------------------
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

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

      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const oldScale = viewport.scale;
      const scaleBy = Math.exp(-e.evt.deltaY * 0.001);
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, oldScale * scaleBy)
      );
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

  // ---------------------------------------------------------------------------
  // Mouse / Touch Event Handlers
  // ---------------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      if (activeTool === "select") {
        const target = e.target;
        const targetId = target.id();
        // If clicking on a selected object (and more than one is selected),
        // do nothing here—group dragging will be handled by the overlay.
        if (selectedIds.includes(targetId) && selectedIds.length > 1) {
          return;
        }
        // If clicking on empty space, start a selection rectangle.
        if (target === stage) {
          if (!e.evt.shiftKey) setSelectedIds([]);
          setIsSelecting(true);
          const pos = stage.getPointerPosition();
          if (!pos) return;
          selectionStart.current = {
            x: (pos.x - stage.x()) / stage.scaleX(),
            y: (pos.y - stage.y()) / stage.scaleY(),
          };
          return;
        }
      }

      // For drawing tools:
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
      } else if (activeTool === "rectangle" || activeTool === "circle") {
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
    },
    [activeTool, selectedIds, lines, shapes, strokeColor, strokeWidth]
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // If selecting (drawing a selection rectangle)
      if (isSelecting && selectionStart.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;
        const stageX = (pos.x - stage.x()) / stage.scaleX();
        const stageY = (pos.y - stage.y()) / stage.scaleY();
        const rect = {
          x: Math.min(selectionStart.current.x, stageX),
          y: Math.min(selectionStart.current.y, stageY),
          width: Math.abs(stageX - selectionStart.current.x),
          height: Math.abs(stageY - selectionStart.current.y),
        };
        setSelectionRect(rect);
        const newSelectedIds: string[] = [];
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
        shapes.forEach((shape) => {
          if (shape.type === "rectangle") {
            if (
              rect.x < shape.x + shape.width &&
              rect.x + rect.width > shape.x &&
              rect.y < shape.y + shape.height &&
              rect.y + rect.height > shape.y
            ) {
              newSelectedIds.push(shape.id);
            }
          } else {
            const radius = Math.abs(shape.width);
            if (
              rect.x < shape.x + radius &&
              rect.x + rect.width > shape.x - radius &&
              rect.y < shape.y + radius &&
              rect.y + rect.height > shape.y - radius
            ) {
              newSelectedIds.push(shape.id);
            }
          }
        });
        if (e.evt.shiftKey) {
          setSelectedIds((prev) =>
            Array.from(new Set([...prev, ...newSelectedIds]))
          );
        } else {
          setSelectedIds(newSelectedIds);
        }
        return;
      }

      // If using drawing tools, update the current drawing.
      if (isDrawing.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;
        const stagePos = {
          x: (pos.x - stage.x()) / stage.scaleX(),
          y: (pos.y - stage.y()) / stage.scaleY(),
        };
        if (activeTool === "pen") {
          const lastLine = lines[lines.length - 1];
          lastLine.points = lastLine.points.concat([stagePos.x, stagePos.y]);
          setLines([...lines.slice(0, -1), lastLine]);
        } else if (activeTool === "rectangle" || activeTool === "circle") {
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
    [activeTool, isSelecting, lines, shapes]
  );

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Stop selection mode (if active)
      if (isSelecting) {
        setIsSelecting(false);
        setSelectionRect(null);
        selectionStart.current = null;
      }

      // Stop any drawing in progress (pen, rectangle, circle)
      if (isDrawing.current) {
        isDrawing.current = false;

        // Optionally: if the shape has negligible dimensions (i.e. click without drag)
        // you might choose to discard it.
        if (activeTool !== "pen") {
          // For rectangle or circle, check if width/height is too small and remove if necessary.
          const lastShape = shapes[shapes.length - 1];
          if (
            lastShape &&
            Math.abs(lastShape.width) < 5 &&
            Math.abs(lastShape.height) < 5
          ) {
            setShapes((prev) => prev.slice(0, prev.length - 1));
          }
        }

        // Finalize the drawing and add a new entry in the history
        addHistoryEntry(stateRef.current);
      }
    },
    [
      isSelecting,
      activeTool,
      shapes,
      addHistoryEntry,
      stateRef,
      setSelectionRect,
      setIsSelecting,
    ]
  );

  // ---------------------------------------------------------------------------
  // Group Drag Handle: When more than one item is selected, render a transparent,
  // dashed rectangle that you can drag to move all selected objects.
  // ---------------------------------------------------------------------------
  const handleGroupDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (!groupBBox) return;
    const newPos = e.target.position();
    const deltaX = newPos.x - groupBBox.x;
    const deltaY = newPos.y - groupBBox.y;
    // Update positions of all selected images.
    setImages((prevImages) =>
      prevImages.map((img) =>
        selectedIds.includes(img.id)
          ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
          : img
      )
    );
    // Update positions of all selected shapes.
    setShapes((prevShapes) =>
      prevShapes.map((shape) =>
        selectedIds.includes(shape.id)
          ? { ...shape, x: shape.x + deltaX, y: shape.y + deltaY }
          : shape
      )
    );
    // Reset the drag handle position to the computed group bounding box.
    e.target.position({ x: groupBBox.x, y: groupBBox.y });
  };

  const handleGroupDragEnd = useCallback(() => {
    addHistoryEntry(stateRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // File Drop & Resize Handlers
  // ---------------------------------------------------------------------------
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
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
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
    }
  }, []);

  const handleImageDelete = useCallback(() => {
    if (selectedId) {
      setImages((prev) => prev.filter((img) => img.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      const newImages = images.filter((img) => !selectedIds.includes(img.id));
      const newShapes = shapes.filter(
        (shape) => !selectedIds.includes(shape.id)
      );
      const newState = {
        images: newImages,
        shapes: newShapes,
        lines,
        viewport,
      };
      addHistoryEntry(newState);
      setImages(newImages);
      setShapes(newShapes);
      setSelectedIds([]);
    }
  }, [selectedIds, images, shapes, lines, viewport]);

  const handleImageDragEnd = useCallback(
    (id: string, newX: number, newY: number) => {
      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === id ? { ...img, x: newX, y: newY } : img
        )
      );
    },
    []
  );

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

  useEffect(() => {
    setStageDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const handleResize = () =>
      setStageDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    container.addEventListener("drop", handleDrop, false);
    container.addEventListener("dragenter", (e) => e.preventDefault(), false);
    container.addEventListener("dragleave", (e) => e.preventDefault(), false);
    return () => {
      container.removeEventListener("dragover", (e) => e.preventDefault());
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragenter", (e) => e.preventDefault());
      container.removeEventListener("dragleave", (e) => e.preventDefault());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [handleDrop, objectUrls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDelete]);

  const imageUrls = [
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/_a_hyper_realistic_rendering_of_an_organically_shaped_house_with_a_curved_marble_exterior__set_against_a_white_background__in_the_style_of_architectural_drawings__flux-dev-lora_1x1_46748.png",
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/A+crazy+man+with+bla_-1.png",
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/a_an_organic_villa_next_to_the_sea_at_the_base_and_a_futuristic_design_aesthetic__hyper_realistic_photograph_ideogram-v2_1x1_664320.png",
  ];

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ position: "relative" }}>
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        draggable={
          activeTool === "select" && selectedIds.length === 0 && !isSelecting
        }
        onWheel={handleWheel}
        x={viewport.x}
        y={viewport.y}
        scale={{ x: viewport.scale, y: viewport.scale }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          const clickedOnEmpty = e.target === e.target.getStage();
          if (clickedOnEmpty) {
            setSelectedId(null);
          }
        }}
        onDragMove={(e) => {
          const stage = e.target.getStage();
          if (stage)
            updateViewport({ ...viewport, x: stage.x(), y: stage.y() });
        }}
        onDragEnd={(e) => {
          const stage = e.target.getStage();
          if (stage)
            updateViewport({ ...viewport, x: stage.x(), y: stage.y() });
        }}
        onTouchStart={(e) => {
          if (e.evt.touches.length === 2) e.evt.preventDefault();
        }}
        onTouchMove={(e) => {
          if (e.evt.touches.length === 2) e.evt.preventDefault();
        }}
      >
        {/* Grid Layer */}
        <Layer>
          <Group>
            {(() => {
              const stageX = -viewport.x / viewport.scale;
              const stageY = -viewport.y / viewport.scale;
              const padding = GRID_SIZE * 10;
              const viewWidth = stageDimensions.width / viewport.scale;
              const viewHeight = stageDimensions.height / viewport.scale;
              const startX =
                Math.floor((stageX - padding) / GRID_SIZE) * GRID_SIZE;
              const endX =
                Math.ceil((stageX + viewWidth + padding) / GRID_SIZE) *
                GRID_SIZE;
              const startY =
                Math.floor((stageY - padding) / GRID_SIZE) * GRID_SIZE;
              const endY =
                Math.ceil((stageY + viewHeight + padding) / GRID_SIZE) *
                GRID_SIZE;
              const gridDots = [];
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
            })()}
          </Group>
        </Layer>

        {/* Images & Selection Rectangle Layer */}
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
              onClick={(e) => {
                e.evt.stopPropagation();
                if (e.evt.shiftKey) {
                  setSelectedIds((prev) =>
                    prev.includes(img.id)
                      ? prev.filter((id) => id !== img.id)
                      : [...prev, img.id]
                  );
                } else {
                  setSelectedIds([img.id]);
                }
              }}
              onDragEnd={handleImageDragEnd}
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
              perfectDrawEnabled={false}
            />
          )}
          {/* Render group drag handle if more than one item is selected */}
          {selectedIds.length > 1 && groupBBox && (
            <Rect
              x={groupBBox.x}
              y={groupBBox.y}
              width={groupBBox.width}
              height={groupBBox.height}
              fill="rgba(0,0,0,0)"
              stroke="blue"
              dash={[5, 5]}
              draggable
              perfectDrawEnabled={false}
              onDragMove={handleGroupDragMove}
              onDragEnd={handleGroupDragEnd}
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
              perfectDrawEnabled={false}
            />
          ))}
          {shapes.map((shape) => {
            const isSelected = selectedIds.includes(shape.id);
            if (shape.type === "rectangle") {
              return (
                <Fragment key={shape.id}>
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
                    perfectDrawEnabled={false}
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
                      perfectDrawEnabled={false}
                    />
                  )}
                </Fragment>
              );
            }
            return (
              <Fragment key={shape.id}>
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
                  perfectDrawEnabled={false}
                />
                {isSelected && (
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={Math.abs(shape.width) + 2}
                    stroke="#0096FF"
                    strokeWidth={2}
                    dash={[5, 5]}
                    perfectDrawEnabled={false}
                  />
                )}
              </Fragment>
            );
          })}
        </Layer>
      </Stage>

      <CanvasControls
        onZoomIn={() => {
          const newScale = Math.min(viewport.scale * 1.06, MAX_SCALE);
          updateViewport({ ...viewport, scale: newScale });
        }}
        onZoomOut={() => {
          updateViewport({
            ...viewport,
            scale: Math.max(viewport.scale / 1.06, MIN_SCALE),
          });
        }}
        onPan={(dx, dy) => {
          updateViewport({
            ...viewport,
            x: viewport.x + dx,
            y: viewport.y + dy,
          });
        }}
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

export default Canva;
