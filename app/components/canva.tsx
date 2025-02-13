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
import DraggableImage from "./canva_components/DraggableImage";

import { ToolType, ShapeType } from "@/app/types/canvas";
import { uploadToS3, createRoomBackup, checkRoomBackupExists, loadRoomBackup } from "../utils/s3-upload";

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
const MIN_SCALE = 0.50; // Minimum zoom out (25% of original size)
const MAX_SCALE = 3;    // Maximum zoom in (300% of original size)
const ZOOM_SPEED = 0.06; // Controls how fast zooming occurs

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
  width?: number;
  height?: number;
}

interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[];
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

// Add new interface for context menu
interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
}

interface CanvasProps {
  roomId: string;
}

// -----------------------------------------------------------------------------
// Main Canvas Component
// -----------------------------------------------------------------------------

// Create a component to load and track image dimensions
const ImageDimensionLoader = ({ 
  url, 
  id,
  onLoad 
}: { 
  url: string;
  id: string;
  onLoad: (id: string, dimensions: { width: number; height: number }) => void 
}) => {
  const [image] = useImage(url);
  
  useEffect(() => {
    if (image) {
      onLoad(id, { width: image.width, height: image.height });
    }
  }, [image, id, onLoad]);
  
  return null;
};

// Add these helper functions at the top of the file
const calculateArrowPoints = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const headlen = 20;

  return [
    from.x, from.y,
    to.x, to.y,
    to.x - headlen * Math.cos(angle - Math.PI / 6),
    to.y - headlen * Math.sin(angle - Math.PI / 6),
    to.x, to.y,
    to.x - headlen * Math.cos(angle + Math.PI / 6),
    to.y - headlen * Math.sin(angle + Math.PI / 6),
  ];
};

const calculateStarPoints = (centerX: number, centerY: number, size: number) => {
  const points: number[] = [];
  const outerRadius = size;
  const innerRadius = size * 0.4;  // Make inner radius 40% of outer radius
  const numPoints = 5;
  const angleStep = (Math.PI * 2) / numPoints;
  const halfAngleStep = angleStep / 2;

  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep - Math.PI / 2;
    // Outer point
    points.push(
      centerX + outerRadius * Math.cos(angle),
      centerY + outerRadius * Math.sin(angle)
    );
    // Inner point
    points.push(
      centerX + innerRadius * Math.cos(angle + halfAngleStep),
      centerY + innerRadius * Math.sin(angle + halfAngleStep)
    );
  }
  return points;
};

const calculateTrianglePoints = (x: number, y: number, width: number, height: number) => {
  return [
    x + width / 2, y,
    x + width, y + height,
    x, y + height
  ];
};

// Add after imports
const isShapeTool = (tool: ToolType): tool is ShapeType => {
  return ["rectangle", "circle", "line", "arrow", "star", "triangle"].includes(tool as string);
};

const CURSOR_TIMEOUT = 1000 * 5; // 5 seconds timeout

const Canva: React.FC<CanvasProps> = ({ roomId }) => {
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
  const [strokeWidth] = useState(2);
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

  // Add state for context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
  });

  // Add state for image dimensions
  const [imageDimensions, setImageDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
  
  const handleImageDimensionLoad = useCallback((id: string, dimensions: { width: number; height: number }) => {
    setImageDimensions(prev => {
      // Only update if dimensions have changed
      const currentDims = prev.get(id);
      if (currentDims?.width === dimensions.width && currentDims?.height === dimensions.height) {
        return prev;
      }
      const newMap = new Map(prev);
      newMap.set(id, dimensions);
      return newMap;
    });
  }, []);

  // Update the groupBBox calculation
  const groupBBox = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    
    images.forEach((img) => {
      if (selectedIds.includes(img.id)) {
        const dims = imageDimensions.get(img.id) || { width: IMAGE_WIDTH, height: IMAGE_HEIGHT };
        xs.push(img.x);
        ys.push(img.y);
        xs.push(img.x + dims.width);
        ys.push(img.y + dims.height);
      }
    });
    
    shapes.forEach((shape) => {
      if (selectedIds.includes(shape.id)) {
        if (shape.type === "rectangle") {
          xs.push(shape.x);
          ys.push(shape.y);
          xs.push(shape.x + shape.width);
          ys.push(shape.y + shape.height);
        } else if (shape.type === "circle") {
          const radius = Math.abs(shape.width);
          xs.push(shape.x - radius);
          xs.push(shape.x + radius);
          ys.push(shape.y - radius);
          ys.push(shape.y + radius);
        }
      }
    });
    
    lines.forEach((line) => {
      if (selectedIds.includes(line.id)) {
        for (let i = 0; i < line.points.length; i += 2) {
          xs.push(line.points[i]);
          ys.push(line.points[i + 1]);
        }
      }
    });
    
    if (xs.length === 0 || ys.length === 0) return null;
    
    const padding = 5;
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...xs) + padding;
    const maxY = Math.max(...ys) + padding;
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [images, shapes, lines, selectedIds, imageDimensions]);

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

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Check if it's a zoom gesture (pinch or ctrl+wheel)
      if (e.evt.ctrlKey) {
        const oldScale = viewport.scale;
        const scaleBy = 1 - e.evt.deltaY * ZOOM_SPEED * 0.5; // Slower zoom for wheel
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, oldScale * scaleBy)
        );

        // Only update if the scale actually changed
        if (newScale !== oldScale) {
          const mousePointTo = {
            x: (pointer.x - viewport.x) / oldScale,
            y: (pointer.y - viewport.y) / oldScale,
          };

          updateViewport({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          });
        }
      } else {
        // Handle panning (two-finger slide or regular wheel)
        const speed = e.evt.shiftKey ? 3 : 1; // Faster pan with shift key
        updateViewport({
          ...viewport,
          x: viewport.x - e.evt.deltaX * speed,
          y: viewport.y - e.evt.deltaY * speed,
        });
      }
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

      // Allow selection when clicking on shapes
      if (activeTool === "select") {
        if (className === "Line" || className === "Rect" || className === "Circle" || className === "Image") {
          return; // Let the shape's onClick handler handle selection
        }

        if (target === stage) {
          e.evt.preventDefault();
          e.evt.stopPropagation();
          if (!e.evt.shiftKey) setSelectedIds([]);
          setIsSelecting(true);
          const pos = stage.getPointerPosition();
          if (!pos) return;
          const stagePos = {
            x: (pos.x - stage.x()) / stage.scaleX(),
            y: (pos.y - stage.y()) / stage.scaleY(),
          };
          selectionStart.current = stagePos;
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
      } else if (isShapeTool(activeTool)) {
        const newShape: Shape = {
          id: `shape-${Date.now()}`,
          type: activeTool,
          x: stagePos.x,
          y: stagePos.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
          points: activeTool === "line" || activeTool === "arrow" 
            ? [stagePos.x, stagePos.y, stagePos.x, stagePos.y]
            : undefined
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
      updateMyPresence({ 
        cursor: stagePos,
        lastUpdate: Date.now()
      });
    }

    if (isSelecting && selectionStart.current) {
      e.evt.preventDefault();
      e.evt.stopPropagation();
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };
      const rect = {
        x: Math.min(selectionStart.current.x, stagePos.x),
        y: Math.min(selectionStart.current.y, stagePos.y),
        width: Math.abs(stagePos.x - selectionStart.current.x),
        height: Math.abs(stagePos.y - selectionStart.current.y),
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
        let isIntersecting = false;
        
        if (shape.type === "rectangle") {
          isIntersecting = (
            rect.x < shape.x + shape.width &&
            rect.x + rect.width > shape.x &&
            rect.y < shape.y + shape.height &&
            rect.y + rect.height > shape.y
          );
        } else if (shape.type === "circle") {
          const radius = Math.abs(shape.width / 2);
          isIntersecting = (
            rect.x < shape.x + radius &&
            rect.x + rect.width > shape.x - radius &&
            rect.y < shape.y + radius &&
            rect.y + rect.height > shape.y - radius
          );
        } else if (shape.type === "star" || shape.type === "arrow" || shape.type === "line" || shape.type === "triangle") {
          // Check if any point of the shape is inside the selection rectangle
          if (shape.points) {
            for (let i = 0; i < shape.points.length; i += 2) {
              const pointX = shape.points[i];
              const pointY = shape.points[i + 1];
              if (
                pointX >= rect.x &&
                pointX <= rect.x + rect.width &&
                pointY >= rect.y &&
                pointY <= rect.y + rect.height
              ) {
                isIntersecting = true;
                break;
              }
            }
          }
        }
        
        if (isIntersecting) {
          newSelectedIds.push(shape.id);
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
      const stage = e.target.getStage();
      if (!stage) return;
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
      } else if (isShapeTool(activeTool)) {
        const lastShape = shapes[shapes.length - 1];
        if (!lastShape) return;

        let updatedShape: Shape;

        switch (lastShape.type) {
          case "circle":
            const dx = stagePos.x - lastShape.x;
            const dy = stagePos.y - lastShape.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            updatedShape = {
              ...lastShape,
              width: radius * 2,
              height: radius * 2
            };
            break;
          case "line":
            updatedShape = {
              ...lastShape,
              width: stagePos.x - lastShape.x,
              height: stagePos.y - lastShape.y,
              points: [lastShape.x, lastShape.y, stagePos.x, stagePos.y]
            };
            break;
          case "arrow":
            updatedShape = {
              ...lastShape,
              width: stagePos.x - lastShape.x,
              height: stagePos.y - lastShape.y,
              points: calculateArrowPoints(
                { x: lastShape.x, y: lastShape.y },
                { x: stagePos.x, y: stagePos.y }
              )
            };
            break;
          case "star":
            const size = Math.max(
              Math.abs(stagePos.x - lastShape.x),
              Math.abs(stagePos.y - lastShape.y)
            );
            updatedShape = {
              ...lastShape,
              width: size * 2,
              height: size * 2,
              points: calculateStarPoints(lastShape.x, lastShape.y, size)
            };
            break;
          case "triangle":
            updatedShape = {
              ...lastShape,
              width: stagePos.x - lastShape.x,
              height: stagePos.y - lastShape.y,
              points: calculateTrianglePoints(
                lastShape.x,
                lastShape.y,
                stagePos.x - lastShape.x,
                stagePos.y - lastShape.y
              )
            };
            break;
          default:
            updatedShape = {
              ...lastShape,
              width: stagePos.x - lastShape.x,
              height: stagePos.y - lastShape.y
            };
        }

        updateShapes([...shapes.slice(0, -1), updatedShape]);
      }
    }
  },
    [
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
    () => {
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
  const handleGroupDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (!groupBBox) return;
    
    const newPos = e.target.position();
    const deltaX = newPos.x - groupBBox.x;
    const deltaY = newPos.y - groupBBox.y;

    // Update images
    const newImages = images.map(img => 
      selectedIds.includes(img.id)
        ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
        : img
    );
    
    // Update shapes
    const newShapes = shapes.map(shape => {
      if (!selectedIds.includes(shape.id)) return shape;
      
      if (shape.type === "star" || shape.type === "arrow" || shape.type === "line" || shape.type === "triangle") {
        // For shapes with points, update all points
        return {
          ...shape,
          points: shape.points?.map((coord, index) => 
            index % 2 === 0 ? coord + deltaX : coord + deltaY
          )
        };
      } else {
        // For regular shapes, just update x and y
        return { ...shape, x: shape.x + deltaX, y: shape.y + deltaY };
      }
    });
    
    // Update lines
    const newLines = lines.map(line => 
      selectedIds.includes(line.id)
        ? {
            ...line,
            points: line.points.map((coord, index) => 
              index % 2 === 0 ? coord + deltaX : coord + deltaY
            )
          }
        : line
    );

    // Update all at once
    updateImages(newImages);
    updateShapes(newShapes);
    updateLines(newLines);

    // Reset the group position
    e.target.position({ x: groupBBox.x, y: groupBBox.y });
  }, [groupBBox, selectedIds, images, shapes, lines, updateImages, updateShapes, updateLines]);

  const handleGroupDragEnd = useCallback(() => {
    addHistoryEntry(stateRef.current);
  }, [addHistoryEntry]);

  // ---------------------------------------------------------------------------
  // File Drop & Resize Handlers
  // ---------------------------------------------------------------------------
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;

    // Get the drop position relative to the stage
    const stageBox = stage.container().getBoundingClientRect();
    const pointerPosition = {
      x: (e.clientX - stageBox.left - viewport.x) / viewport.scale,
      y: (e.clientY - stageBox.top - viewport.y) / viewport.scale
    };
    
    try {
      // First check if files were dropped
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        // Handle local file upload
        const file = files[0];
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are supported');
        }
        
        // Create a plain object with the necessary file data
        const fileData = {
          arrayBuffer: async () => {
            const buffer = await file.arrayBuffer();
            return buffer;
          },
          type: file.type,
          size: file.size,
          name: file.name
        };
        
        // Show loading state
        const loadingId = `loading-${Date.now()}`;
        const loadingImage = {
          id: loadingId,
          url: '', // placeholder
          x: pointerPosition.x - IMAGE_WIDTH / 2,
          y: pointerPosition.y - IMAGE_HEIGHT / 2
        };
        updateImages([...images, loadingImage]);
        
        try {
          // Upload the file to S3
          const imageUrl = await uploadToS3(fileData);
          
          // Replace loading image with actual image
          const newImage = {
            ...loadingImage,
            url: imageUrl
          };
          
          updateImages(images.map(img => 
            img.id === loadingId ? newImage : img
          ));
          
          addHistoryEntry({
            ...stateRef.current,
            images: images.map(img => 
              img.id === loadingId ? newImage : img
            )
          });
          return;
        } catch (uploadError) {
          // Remove loading image if upload fails
          updateImages(images.filter(img => img.id !== loadingId));
          throw uploadError;
        }
      }

      // Try to get image URL from HTML content first
      const html = e.dataTransfer?.getData('text/html');
      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        
        // First try to get the data-image-link attribute
        let imageUrl = img?.getAttribute('data-image-link');
        
        // If no data-image-link, try src
        if (!imageUrl) {
          imageUrl = img?.src;
        }
        
        if (imageUrl) {
          // Create and add the new image
          const newImage = {
            id: `image-${Date.now()}-${Math.random()}`,
            url: imageUrl,
            x: pointerPosition.x - IMAGE_WIDTH / 2,
            y: pointerPosition.y - IMAGE_HEIGHT / 2
          };
          
          updateImages([...images, newImage]);
          addHistoryEntry({
            ...stateRef.current,
            images: [...images, newImage]
          });
          return;
        }
      }

      // If no HTML content, try other data types
      const imageUrl = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
      
      if (!imageUrl) {
        console.error('No image URL found in dropped content');
        return;
      }

      try {
        // Validate URL
        const url = new URL(imageUrl);
        if (!url.protocol.startsWith('http')) {
          throw new Error('Invalid image URL protocol');
        }

        // Create and add the new image
        const newImage = {
          id: `image-${Date.now()}-${Math.random()}`,
          url: imageUrl,
          x: pointerPosition.x - IMAGE_WIDTH / 2,
          y: pointerPosition.y - IMAGE_HEIGHT / 2
        };
        
        updateImages([...images, newImage]);
        addHistoryEntry({
          ...stateRef.current,
          images: [...images, newImage]
        });

      } catch (error) {
        console.error('Error processing dropped image:', error);
        alert(`Error adding image: ${error instanceof Error ? error.message : 'Invalid image URL'}`);
      }

    } catch (error) {
      const err = error as Error;
      console.error('Error handling image drop:', err);
      alert(`Error adding image: ${err.message}`);
    }
  }, [images, viewport.scale, viewport.x, viewport.y, updateImages, addHistoryEntry, stateRef]);

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

  const handleImageResize = useCallback((
    id: string,
    newWidth: number,
    newHeight: number,
    newX: number,
    newY: number
  ) => {
    const newImages = images.map((img) =>
      img.id === id
        ? { ...img, width: newWidth, height: newHeight, x: newX, y: newY }
        : img
    );
    updateImages(newImages);
    addHistoryEntry({
      ...stateRef.current,
      images: newImages
    });
  }, [images, updateImages, addHistoryEntry, stateRef]);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    // Use a named function for the event handler to maintain consistency
    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener("dragover", preventDefault);
    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragenter", preventDefault);
    container.addEventListener("dragleave", preventDefault);

    return () => {
      container.removeEventListener("dragover", preventDefault);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragenter", preventDefault);
      container.removeEventListener("dragleave", preventDefault);
    };
  }, [handleDrop]);

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
        try {
          // Try to load from backup first
          const backupData = await loadRoomBackup(roomId);
          
          if (backupData) {
            // If backup exists, use it
            console.log('Loading room data from backup');
            await Promise.all([
              updateImages(backupData.images || []),
              updateShapes(backupData.shapes || []),
              updateLines(backupData.lines || [])
            ]);
          } else {
            // If no backup, initialize with default images
            console.log('Initializing new room with default state');
            const initialImages = imageUrls.map((url, index) => ({
              id: `image-${index}`,
              url,
              x: (index % GRID_COLUMNS) * (IMAGE_WIDTH + IMAGE_GAP) + IMAGE_GAP,
              y: Math.floor(index / GRID_COLUMNS) * (IMAGE_HEIGHT + IMAGE_GAP) + IMAGE_GAP,
            }));
            
            await Promise.all([
              updateImages(initialImages),
              updateShapes([]),
              updateLines([])
            ]);
          }
        } catch (error) {
          console.error('Failed to initialize storage:', error);
        }
      } else {
        // Room exists in Liveblocks, use existing data
        if (!storage.images) updateImages([]);
        if (!storage.shapes) updateShapes([]);
        if (!storage.lines) updateLines([]);
        console.log('Room already has state, using existing data');
      }
    };

    initializeStorage();
  }, [storage, isStorageLoading, updateImages, updateShapes, updateLines, imageUrls, roomId]);

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

  // Add clipboard handling functions
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;

    const clipboardData = {
      images: images.filter(img => selectedIds.includes(img.id)),
      shapes: shapes.filter(shape => selectedIds.includes(shape.id)),
      lines: lines.filter(line => selectedIds.includes(line.id))
    };

    localStorage.setItem('canvas_clipboard', JSON.stringify(clipboardData));
  }, [selectedIds, images, shapes, lines]);

  const handlePaste = useCallback(() => {
    const clipboardStr = localStorage.getItem('canvas_clipboard');
    if (!clipboardStr) return;

    try {
      const clipboard = JSON.parse(clipboardStr);
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert stage position to world coordinates
      const worldPos = {
        x: (pointer.x - viewport.x) / viewport.scale,
        y: (pointer.y - viewport.y) / viewport.scale
      };

      // Calculate offset from original positions to maintain relative positioning
      const offsetX = worldPos.x - (clipboard.images[0]?.x || clipboard.shapes[0]?.x || clipboard.lines[0]?.points[0] || 0);
      const offsetY = worldPos.y - (clipboard.images[0]?.y || clipboard.shapes[0]?.y || clipboard.lines[0]?.points[1] || 0);

      // Create new items with new IDs and positions
      const newImages = clipboard.images.map((img: CanvasImage) => ({
        ...img,
        id: `image-${Date.now()}-${Math.random()}`,
        x: img.x + offsetX,
        y: img.y + offsetY
      }));

      const newShapes = clipboard.shapes.map((shape: Shape) => ({
        ...shape,
        id: `shape-${Date.now()}-${Math.random()}`,
        x: shape.x + offsetX,
        y: shape.y + offsetY
      }));

      const newLines = clipboard.lines.map((line: Line) => ({
        ...line,
        id: `line-${Date.now()}-${Math.random()}`,
        points: line.points.map((coord: number, index: number) => 
          index % 2 === 0 ? coord + offsetX : coord + offsetY
        )
      }));

      // Update storage with new items
      updateImages([...images, ...newImages]);
      updateShapes([...shapes, ...newShapes]);
      updateLines([...lines, ...newLines]);

      // Select newly pasted items
      const newIds = [...newImages.map((img: CanvasImage) => img.id), 
                     ...newShapes.map((shape: Shape) => shape.id),
                     ...newLines.map((line: Line) => line.id)];
      setSelectedIds(newIds);
      
      addHistoryEntry(stateRef.current);
    } catch (error) {
      console.error('Failed to paste items:', error);
    }
  }, [viewport, images, shapes, lines, updateImages, updateShapes, updateLines, addHistoryEntry]);

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        handleCopy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        handlePaste();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleDelete]);

  // Add context menu handler
  const handleContextMenu = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    if (selectedIds.length > 0) {
      setContextMenu({
        show: true,
        x: e.evt.clientX,
        y: e.evt.clientY
      });
    }
  }, [selectedIds]);

  // Add click handler to close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu({ show: false, x: 0, y: 0 });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Add this effect after other useEffect hooks
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateMyPresence({ cursor: null, lastUpdate: Date.now() });
      }
    };
    const handleBeforeUnload = () => {
      updateMyPresence({ cursor: null, lastUpdate: Date.now() });
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updateMyPresence({ cursor: null, lastUpdate: Date.now() });
    };
  }, [updateMyPresence]);

  const othersWithTimestamp = useMemo(() => {
    return others.filter((user) => {
      if (!user.presence?.cursor) return false;
      const lastUpdate = user.presence?.lastUpdate || Date.now();
      const now = Date.now();
      return (now - lastUpdate) < CURSOR_TIMEOUT;
    });
  }, [others]);

  // Add backup check effect
  useEffect(() => {
    const checkAndCreateBackup = async () => {
      try {
        // Check if backup exists
        const hasBackup = await checkRoomBackupExists(roomId);
        if (!hasBackup) {
          // Create a backup after 20 days (20 * 24 * 60 * 60 * 1000 = 1728000000 ms)
          setTimeout(async () => {
            const backupState = {
              images,
              shapes,
              lines,
              createdAt: new Date().toISOString(),
            };
            await createRoomBackup(roomId, backupState);
          }, 1728000000);
        }
      } catch (error) {
        console.error('Error handling room backup:', error);
      }
    };

    checkAndCreateBackup();
  }, [roomId, images, shapes, lines]);

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
      {/* Add ImageDimensionLoader components */}
      {images.map((img) => (
        <ImageDimensionLoader
          key={img.id}
          id={img.id}
          url={img.url}
          onLoad={handleImageDimensionLoad}
        />
      ))}
      
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        draggable={
          activeTool === "hand" || (activeTool === "select" && !isSelecting && selectedIds.length === 0)
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
          if (clickedOnEmpty && !isSelecting) {
            setSelectedIds([]);
          }
        }}
        onDragMove={(e) => {
          if (activeTool === "hand" || (!isSelecting && selectedIds.length === 0)) {
            const stage = e.target.getStage();
            if (stage) {
              updateViewport({ ...viewport, x: stage.x(), y: stage.y() });
            }
          }
        }}
        onDragEnd={(e) => {
          if (activeTool === "hand" || (!isSelecting && selectedIds.length === 0)) {
            const stage = e.target.getStage();
            if (stage) {
              updateViewport({ ...viewport, x: stage.x(), y: stage.y() });
            }
          }
        }}
        onTouchStart={(e) => {
          if (e.evt.touches.length === 2) e.evt.preventDefault();
        }}
        onTouchMove={(e) => {
          if (e.evt.touches.length === 2) e.evt.preventDefault();
        }}
        onContextMenu={handleContextMenu}
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
              width={img.width}
              height={img.height}
              isSelected={selectedIds.includes(img.id)}
              activeTool={activeTool}
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
              onResize={handleImageResize}
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
          {/* Group selection rectangle */}
          {selectedIds.length > 1 && groupBBox && (
            <Rect
              x={groupBBox.x}
              y={groupBBox.y}
              width={groupBBox.width}
              height={groupBBox.height}
              stroke="#0096FF"
              strokeWidth={2}
              dash={[5, 5]}
              fill="transparent"
              draggable
              onDragMove={handleGroupDragMove}
              onDragEnd={handleGroupDragEnd}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'move';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
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
                onDragStart={(e) => {
                  // Store initial position for reference
                  e.target.setAttr('lastX', e.target.x());
                  e.target.setAttr('lastY', e.target.y());
                }}
                onDragMove={(e) => {
                  const target = e.target;
                  const lastX = target.getAttr('lastX') || 0;
                  const lastY = target.getAttr('lastY') || 0;
                  const newX = target.x();
                  const newY = target.y();
                  const dx = newX - lastX;
                  const dy = newY - lastY;

                  const newPoints = [...line.points];
                  for (let i = 0; i < newPoints.length; i += 2) {
                    newPoints[i] += dx;
                    newPoints[i + 1] += dy;
                  }

                  const updatedLine = { ...line, points: newPoints };
                  updateLines(lines.map(l => l.id === line.id ? updatedLine : l));

                  // Update last position
                  target.setAttr('lastX', newX);
                  target.setAttr('lastY', newY);
                }}
                onDragEnd={(e) => {
                  // Reset position after drag
                  e.target.position({ x: 0, y: 0 });
                  e.target.setAttr('lastX', 0);
                  e.target.setAttr('lastY', 0);
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
            const commonProps = {
              onClick: (e: KonvaEventObject<MouseEvent>) => {
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
              },
              stroke: shape.color,
              strokeWidth: shape.strokeWidth,
              draggable: selectedIds.length <= 1,
              onDragMove: (e: KonvaEventObject<DragEvent>) => {
                const updatedShape = { ...shape, x: e.target.x(), y: e.target.y() };
                updateShapes(shapes.map(s => s.id === shape.id ? updatedShape : s));
              },
              onDragEnd: () => {
                addHistoryEntry(stateRef.current);
              },
              perfectDrawEnabled: false,
            };

            switch (shape.type) {
              case "rectangle":
                return (
                  <Fragment key={shape.id}>
                    <Rect
                      key={`${shape.id}-shape`}
                      {...commonProps}
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      fill="transparent"
                    />
                    {isSelected && (
                      <Rect
                        key={`${shape.id}-selection`}
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
              case "circle":
                return (
                  <Fragment key={shape.id}>
                    <Circle
                      key={`${shape.id}-shape`}
                      {...commonProps}
                      x={shape.x}
                      y={shape.y}
                      radius={Math.abs(shape.width / 2)}
                      fill="transparent"
                    />
                    {isSelected && (
                      <Circle
                        key={`${shape.id}-selection`}
                        x={shape.x}
                        y={shape.y}
                        radius={Math.abs(shape.width / 2) + 2}
                        stroke="#0096FF"
                        strokeWidth={2}
                        dash={[5, 5]}
                        perfectDrawEnabled={false}
                      />
                    )}
                  </Fragment>
                );
              case "line":
              case "arrow":
              case "star":
                return (
                  <Fragment key={shape.id}>
                    <Line
                      key={`${shape.id}-shape`}
                      {...commonProps}
                      points={shape.points || []}
                      fill={shape.type === "star" ? "transparent" : undefined}
                      closed={shape.type === "star"}
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
                    />
                    {isSelected && (
                      <Line
                        key={`${shape.id}-selection`}
                        points={shape.points || []}
                        stroke="#0096FF"
                        strokeWidth={shape.strokeWidth + 4}
                        dash={[5, 5]}
                        perfectDrawEnabled={false}
                        closed={shape.type === "star"}
                      />
                    )}
                  </Fragment>
                );
              case "triangle":
                return (
                  <Fragment key={shape.id}>
                    <Line
                      key={`${shape.id}-shape`}
                      {...commonProps}
                      points={shape.points || []}
                      closed={true}
                      fill="transparent"
                    />
                    {isSelected && (
                      <Line
                        key={`${shape.id}-selection`}
                        points={shape.points || []}
                        closed={true}
                        stroke="#0096FF"
                        strokeWidth={2}
                        dash={[5, 5]}
                        perfectDrawEnabled={false}
                      />
                    )}
                  </Fragment>
                );
              default:
                return null;
            }
          })}
        </Layer>
        <Layer>
          {/* Render other users' cursors */}
          {othersWithTimestamp.map(({ connectionId, presence }) => {
            if (presence?.cursor == null) return null;
            
            if (!cursorImg) {
              return (
                <Circle
                  key={`cursor-${connectionId}`}
                  x={presence.cursor.x}
                  y={presence.cursor.y}
                  radius={5}
                  fill="blue"
                />
              );
            }

            return (
              <KonvaImage
                key={`cursor-${connectionId}`}
                image={cursorImg}
                x={presence.cursor.x - 10}
                y={presence.cursor.y - 10}
                width={50}
                height={50}
              />
            );
          })}
        </Layer>
      </Stage>

      <CanvasControlsComponent
        onZoomIn={() => {
          const newScale = Math.min(viewport.scale * (1 + ZOOM_SPEED), MAX_SCALE);
          if (newScale !== viewport.scale) {
            updateViewport({ ...viewport, scale: newScale });
          }
        }}
        onZoomOut={() => {
          const newScale = Math.max(viewport.scale * (1 - ZOOM_SPEED), MIN_SCALE);
          if (newScale !== viewport.scale) {
            updateViewport({ ...viewport, scale: newScale });
          }
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {contextMenu.show && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'white',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
              setContextMenu({ show: false, x: 0, y: 0 });
            }}
            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
          >
            Copy
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePaste();
              setContextMenu({ show: false, x: 0, y: 0 });
            }}
            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
          >
            Paste
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
              setContextMenu({ show: false, x: 0, y: 0 });
            }}
            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default Canva;
