"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  useMemo,
} from "react";
import {
  Stage,
  Layer,
  Circle,
  Image as KonvaImage,
  Group,
  Rect,
  Line,
} from "react-konva";
import type Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";

import useImage from "use-image";
import {
  useUpdateMyPresence,
  useOthers,
  useStorage,
  useMutation,
  Storage,
  Presence
} from "../liveblocks.config";
import { MutationContext } from "@liveblocks/react";
import { BaseUserMeta } from "@liveblocks/client";

// Import new components
import LoadingSpinner from "./ui/LoadingSpinner";
import { default as CanvasControlsComponent } from "./canva_components/CanvasControls";
import Toolbar  from "./canva_components/Toolbar";


// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function throttle<T extends unknown[]>(func: (...args: T) => void, limit: number) {
  let inThrottle: boolean;
  return function (...args: T) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
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



interface CanvasState {
  images: CanvasImage[];
  shapes: Shape[];
  lines: Line[];
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

interface Line {
  id: string;
  tool: "pen";
  points: number[];
  color: string;
  width: number;
}

type ToolType = "select" | "pen" | "rectangle" | "circle" | "hand";

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
}: DraggableImageProps) => {
  const [image] = useImage(url);
  return (
    <>
      {/* Explicitly set the id so that KonvaEventObject.id() returns it */}
      <KonvaImage
        id={id}
        image={image}
        x={x}
        y={y}
        draggable={selectedIds.length <= 1}
        onClick={onClick}
        onDragEnd={(e: KonvaEventObject<DragEvent>) =>
          onDragEnd(id, e.target.x(), e.target.y())
        }
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
// Toolbar Component
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Main Canvas Component
// -----------------------------------------------------------------------------

const Canva = () => {
  // Konva Stage Ref
  const stageRef = useRef<Konva.Stage>(null);

  // Viewport & Stage Dimensions
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: INITIAL_SCALE,
  });
  const [stageDimensions, setStageDimensions] = useState(INITIAL_DIMENSIONS);

  // Selection State
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
  const isDrawing = useRef(false);

  // History State for Undo/Redo
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const stateRef = useRef<CanvasState>({
    images: [],
    shapes: [],
    lines: [],
    viewport: { x: 0, y: 0, scale: INITIAL_SCALE },
  });

  // Liveblocks state
  const storage = useStorage((root) => root) as Storage | null;
  const isStorageLoading = storage === null;

  const memoizedStorage = useMemo(() => ({
    shapes: (storage?.shapes ?? []) as Storage["shapes"],
    images: (storage?.images ?? []) as Storage["images"],
    lines: (storage?.lines ?? []) as Storage["lines"]
  }), [storage]);

  const { shapes, images, lines } = memoizedStorage;
  
  // Create mutations for updating storage
  const updateShapes = useMutation((
    { storage }: MutationContext<Presence, Storage, BaseUserMeta>,
    newShapes: Storage["shapes"]
  ) => {
    storage.set("shapes", newShapes);
  }, []);

  const updateImages = useMutation((
    { storage }: MutationContext<Presence, Storage, BaseUserMeta>,
    newImages: Storage["images"]
  ) => {
    storage.set("images", newImages);
  }, []);

  const updateLines = useMutation((
    { storage }: MutationContext<Presence, Storage, BaseUserMeta>,
    newLines: Storage["lines"]
  ) => {
    storage.set("lines", newLines);
  }, []);

  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();

  const throttledUpdateViewport = useRef(
    throttle((newViewport: ViewportState) => {
      setViewport(newViewport);
      if (stageRef.current) stageRef.current.batchDraw();
    }, 16)
  ).current;

  // Add this near the top with other hooks
  const [cursorImg] = useImage("/cursor.png");

  // ---------------------------------------------------------------------------
  // Compute Group Bounding Box for Selected Items
  // ---------------------------------------------------------------------------
  const groupBBox = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    
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
    throttledUpdateViewport(newViewport);
  }, [throttledUpdateViewport]);

  useEffect(() => {
    stateRef.current = {
      images,
      shapes,
      lines: lines.map(line => ({ ...line, tool: "pen" })),
      viewport
    };
  }, [images, shapes, lines, viewport]);

  const addHistoryEntry = useCallback((newState: CanvasState) => {
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory.slice(0, currentIndex + 1), newState];
      return newHistory;
    });
    setCurrentIndex((prevIndex) => prevIndex + 1);
  }, [currentIndex]);

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
        y: mousePointTo.y * newScale,
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

      const target = e.target;
      const className = target.getClassName();
      if (
        className === "Line" ||
        className === "Rect" ||
        className === "Image"
      ) {
        return;
      }

      if (activeTool === "select") {
        if (target === stage) {
          if (!e.evt.shiftKey) setSelectedIds([]);
          setIsSelecting(true);
          const pos = stage.getPointerPosition();
          if (!pos) return;
          selectionStart.current = {
            x: (pos.x - stage.x()) / stage.scaleX(),
            y: (pos.y - stage.y()) / stage.scaleY(),
          };
        }
        return;
      }

      isDrawing.current = true;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };

      if (activeTool === "pen") {
        const newLine = {
          id: `line-${Date.now()}`,
          tool: "pen",
          points: [stagePos.x, stagePos.y],
          color: strokeColor,
          width: strokeWidth,
        };
        updateLines([...lines, newLine]);
      } else if (activeTool === "rectangle" || activeTool === "circle") {
        const newShape = {
          id: `shape-${Date.now()}`,
          type: activeTool,
          x: stagePos.x,
          y: stagePos.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        };
        updateShapes([...shapes, newShape]);
      }
    },
    [activeTool, lines, shapes, strokeColor, strokeWidth, updateLines, updateShapes]
  );

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (pos) {
      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };
      updateMyPresence({ cursor: stagePos });
    }

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

      // Check for images
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

      // Check for shapes
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

      // Check for lines
      lines.forEach((line) => {
        for (let i = 0; i < line.points.length; i += 2) {
          const pointX = line.points[i];
          const pointY = line.points[i + 1];
          if (
            pointX >= rect.x &&
            pointX <= rect.x + rect.width &&
            pointY >= rect.y &&
            pointY <= rect.y + rect.height
          ) {
            newSelectedIds.push(line.id);
            break;
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

    if (isDrawing.current) {
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };
      if (activeTool === "pen") {
        const lastLine = lines[lines.length - 1];
        const updatedLine = {
          ...lastLine,
          tool: "pen",
          points: lastLine.points.concat([stagePos.x, stagePos.y]),
        };
        updateLines([...lines.slice(0, -1), updatedLine]);
      } else if (activeTool === "rectangle" || activeTool === "circle") {
        const lastShape = shapes[shapes.length - 1];
        const updatedShape = {
          ...lastShape,
          width: stagePos.x - lastShape.x,
          height: stagePos.y - lastShape.y,
        };
        updateShapes([...shapes.slice(0, -1), updatedShape]);
      }
    }
  }, [
    activeTool,
    isSelecting,
    lines,
    shapes,
    images,
    updateLines,
    updateShapes,
    updateMyPresence,
    setSelectedIds,
    setSelectionRect
  ]);

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      if (isSelecting) {
        setIsSelecting(false);
        setSelectionRect(null);
        selectionStart.current = null;
      }

      if (isDrawing.current) {
        isDrawing.current = false;

        if (activeTool !== "pen") {
          const lastShape = shapes[shapes.length - 1];
          if (
            lastShape &&
            Math.abs(lastShape.width) < 5 &&
            Math.abs(lastShape.height) < 5
          ) {
            updateShapes(shapes.slice(0, shapes.length - 1));
          }
        }

        addHistoryEntry(stateRef.current);
      }
    },
    [isSelecting, activeTool, shapes, addHistoryEntry, stateRef, updateShapes]
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
    
    const newImages = images.map((img: Storage["images"][0]) =>
      selectedIds.includes(img.id)
        ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
        : img
    );
    
    const newShapes = shapes.map((shape: Storage["shapes"][0]) =>
      selectedIds.includes(shape.id)
        ? { ...shape, x: shape.x + deltaX, y: shape.y + deltaY }
        : shape
    );
    
    updateImages(newImages);
    updateShapes(newShapes);
    e.target.position({ x: groupBBox.x, y: groupBBox.y });
  };

  const handleGroupDragEnd = useCallback(() => {
    addHistoryEntry(stateRef.current);
  }, [addHistoryEntry]);

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
          const newImage: Storage["images"][0] = {
            id: `image-${Date.now()}`,
            url: objectUrl,
            x: stagePos.x,
            y: stagePos.y,
          };
          updateImages([...images, newImage]);
        }
      });
    }
  }, [images, updateImages]);

  const handleImageDelete = useCallback(() => {
    if (selectedId) {
      const newImages = images.filter((img) => img.id !== selectedId);
      updateImages(newImages);
      setSelectedId(null);
    }
  }, [selectedId, images, updateImages]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      const newImages = images.filter((img) => !selectedIds.includes(img.id));
      const newShapes = shapes.filter((shape) => !selectedIds.includes(shape.id));
      const newLines = lines.filter((line) => !selectedIds.includes(line.id));
      
      updateImages(newImages);
      updateShapes(newShapes);
      updateLines(newLines);
      setSelectedIds([]);
      addHistoryEntry(stateRef.current);
    }
  }, [selectedIds, images, shapes, lines, updateImages, updateShapes, updateLines, addHistoryEntry]);

  const handleImageDragEnd = useCallback(
    (id: string, newX: number, newY: number) => {
      const newImages = images.map((img: Storage["images"][0]) =>
        img.id === id ? { ...img, x: newX, y: newY } : img
      );
      updateImages(newImages);
    },
    [images, updateImages]
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
        // Convert the file to base64
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Url = e.target?.result as string;
          const newImage = {
            id: `image-${Date.now()}`,
            url: base64Url,
            x: stagePos.x,
            y: stagePos.y,
          };
          updateImages([...images, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, [images, updateImages]);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    container.addEventListener("dragover", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    });
    container.addEventListener("drop", handleFileDrop);
    return () => {
      container.removeEventListener("dragover", (e: Event) => e.preventDefault());
      container.removeEventListener("drop", handleFileDrop);
    };
  }, [handleFileDrop]);

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
    };
  }, [handleDrop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDelete]);

  const imageUrls = useMemo(() => [
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/_a_hyper_realistic_rendering_of_an_organically_shaped_house_with_a_curved_marble_exterior__set_against_a_white_background__in_the_style_of_architectural_drawings__flux-dev-lora_1x1_46748.png",
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/A+crazy+man+with+bla_-1.png",
    "https://xfigurabucket.s3.us-east-1.amazonaws.com/a_an_organic_villa_next_to_the_sea_at_the_base_and_a_futuristic_design_aesthetic__hyper_realistic_photograph_ideogram-v2_1x1_664320.png",
  ], []);

  // Move initial data loading to a separate effect that runs only when storage is ready
  useEffect(() => {
    const initializeStorage = async () => {
      if (!storage || isStorageLoading) return;

      // Check if the room is completely new (no storage initialized)
      const isNewRoom = !storage.images && !storage.shapes && !storage.lines;
      
      if (isNewRoom) {
        // Only initialize with default images if it's a new room
        const initialImages = imageUrls.map((url, index) => ({
          id: `image-${index}`,
          url,
          x: (index % GRID_COLUMNS) * (IMAGE_WIDTH + IMAGE_GAP) + IMAGE_GAP,
          y: Math.floor(index / GRID_COLUMNS) * (IMAGE_HEIGHT + IMAGE_GAP) + IMAGE_GAP,
        }));
        
        try {
          await Promise.all([
            updateImages(initialImages),
            updateShapes([]),
            updateLines([])
          ]);
          console.log('Initialized new room with default state');
        } catch (error) {
          console.error('Failed to initialize storage:', error);
        }
      } else {
        if (!storage.images) updateImages([]);
        if (!storage.shapes) updateShapes([]);
        if (!storage.lines) updateLines([]);
        console.log('Room already has state, using existing data');
      }
    };

    initializeStorage();
  }, [storage, isStorageLoading, updateImages, updateShapes, updateLines, imageUrls]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      const newIndex = currentIndex - 1;
      const state = history[newIndex];
      updateImages(state.images);
      updateShapes(state.shapes);
      updateLines(state.lines.map(line => ({ ...line, tool: "pen" })));
      updateViewport(state.viewport);
      setCurrentIndex(newIndex);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      const newIndex = currentIndex + 1;
      const state = history[newIndex];
      updateImages(state.images);
      updateShapes(state.shapes);
      updateLines(state.lines.map(line => ({ ...line, tool: "pen" })));
      updateViewport(state.viewport);
      setCurrentIndex(newIndex);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isStorageLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ 
      position: "relative", 
      width: "100vw", 
      height: "100vh", 
      overflow: "hidden",
      margin: 0,
      padding: 0
    }}>
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        draggable={
          activeTool === "hand" || (activeTool === "select" && selectedIds.length === 0 && !isSelecting)
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
              const startX = Math.floor((stageX - padding) / GRID_SIZE) * GRID_SIZE;
              const endX = Math.ceil((stageX + viewWidth + padding) / GRID_SIZE) * GRID_SIZE;
              const startY = Math.floor((stageY - padding) / GRID_SIZE) * GRID_SIZE;
              const endY = Math.ceil((stageY + viewHeight + padding) / GRID_SIZE) * GRID_SIZE;
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
          {lines.map((line) => {
            const isSelected = selectedIds.includes(line.id);
            return (
              <Line
                key={line.id}
                id={line.id}
                points={line.points}
                stroke={isSelected ? "#0096FF" : line.color}
                strokeWidth={line.width}
                tension={0.5}
                lineCap="round"
                perfectDrawEnabled={false}
                hitStrokeWidth={Math.max(line.width + 20, 20)}
                draggable={selectedIds.length <= 1}
                onClick={(e) => {
                  e.evt.stopPropagation();
                  if (e.evt.shiftKey) {
                    setSelectedIds((prev) =>
                      prev.includes(line.id)
                        ? prev.filter((id) => id !== line.id)
                        : [...prev, line.id]
                    );
                  } else {
                    setSelectedIds([line.id]);
                  }
                }}
                onDragMove={(e) => {
                  const newPoints = line.points.map((point, i) => {
                    if (i % 2 === 0) return point + e.target.x();
                    return point + e.target.y();
                  });
                  const updatedLine = { ...line, points: newPoints };
                  updateLines(lines.map(l => l.id === line.id ? updatedLine : l));
                  e.target.position({ x: 0, y: 0 }); // Reset position after updating points
                }}
                onDragEnd={() => {
                  addHistoryEntry(stateRef.current);
                }}
                shadowEnabled={isSelected}
                shadowColor="#0096FF"
                shadowBlur={10}
                shadowOpacity={0.5}
              />
            );
          })}
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
                    draggable={selectedIds.length <= 1}
                    onClick={(e) => {
                      e.evt.stopPropagation();
                      if (e.evt.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(shape.id)
                            ? prev.filter((id) => id !== shape.id)
                            : [...prev, shape.id]
                        );
                      } else {
                        setSelectedIds([shape.id]);
                      }
                    }}
                    onDragMove={(e) => {
                      const updatedShape = { ...shape, x: e.target.x(), y: e.target.y() };
                      updateShapes(shapes.map(s => s.id === shape.id ? updatedShape : s));
                    }}
                    onDragEnd={() => {
                      addHistoryEntry(stateRef.current);
                    }}
                    perfectDrawEnabled={false}
                  />
                  {isSelected && (
                    <Rect
                      key={`${shape.id}-overlay`}
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
                  draggable={selectedIds.length <= 1}
                  onClick={(e) => {
                    e.evt.stopPropagation();
                    if (e.evt.shiftKey) {
                      setSelectedIds((prev) =>
                        prev.includes(shape.id)
                          ? prev.filter((id) => id !== shape.id)
                          : [...prev, shape.id]
                      );
                    } else {
                      setSelectedIds([shape.id]);
                    }
                  }}
                  onDragMove={(e) => {
                    const updatedShape = { ...shape, x: e.target.x(), y: e.target.y() };
                    updateShapes(shapes.map(s => s.id === shape.id ? updatedShape : s));
                  }}
                  onDragEnd={() => {
                    addHistoryEntry(stateRef.current);
                  }}
                  perfectDrawEnabled={false}
                />
                {isSelected && (
                  <Circle
                    key={`${shape.id}-overlay`}
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
        <Layer>
          {/* Render other users' cursors */}
          {others.map((other) => {
            const otherCursor = other.presence?.cursor;
            if (!otherCursor) return null;

            // Use the cursorImg from the hook above
            if (!cursorImg) {
              return (
                <Circle
                  key={`cursor-${other.connectionId}`}
                  x={otherCursor.x}
                  y={otherCursor.y}
                  radius={5}
                  fill="blue"
                />
              );
            }

            return (
              <KonvaImage
                key={`cursor-${other.connectionId}`}
                image={cursorImg}
                x={otherCursor.x - 10}
                y={otherCursor.y - 10}
                width={50}
                height={50}
              />
            );
          })}
        </Layer>
      </Stage>

      <CanvasControlsComponent
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
