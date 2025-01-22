"use client";
import { Stage, Layer, Circle, Image, Group, Rect } from "react-konva";
import type Konva from "konva";
import { useState, useEffect, useRef, useCallback } from "react";
import useImage from "use-image";
import { KonvaEventObject } from "konva/lib/Node";

const GRID_SIZE = 50;
const INITIAL_SCALE = 1;
const INITIAL_DIMENSIONS = {
  width: 1000, // default width
  height: 800, // default height
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_FACTOR = 1.06;

// Add these constants
const BASE_GRID_SIZE = 50;
const MIN_VISIBLE_GRID_SIZE = 20;

// Update constants at top
const IMAGE_GAP = 1000; // Increased gap between images
const GRID_COLUMNS = 3;
const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 200;

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
  url: string;
  x: number;
  y: number;
  isSelected: boolean;
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
  onDelete: () => void;
}

// Update DraggableImage component
const DraggableImage = ({
  url,
  x,
  y,
  isSelected,
  onClick,
}: DraggableImageProps) => {
  const [image] = useImage(url);
  const [position, setPosition] = useState({ x, y });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (image) {
      setDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    }
  }, [image]);

  return (
    <Image
      image={image}
      x={position.x}
      y={position.y}
      width={dimensions.width}
      height={dimensions.height}
      draggable
      onClick={onClick}
      stroke={isSelected ? "#0096FF" : undefined}
      strokeWidth={isSelected ? 2 : 0}
      shadowEnabled={true}
      shadowColor={isSelected ? "#0096FF" : "black"}
      shadowBlur={isSelected ? 10 : 5}
      shadowOpacity={0.6}
      onDragEnd={(e) => {
        setPosition({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
    />
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

  // 2. All ref hooks
  const stageRef = useRef<Konva.Stage>(null);
  const gridLayerRef = useRef<Konva.Layer>(null);
  const rafRef = useRef<number | null>(null);

  // 3. All callback hooks - define ALL of them here
  const updateViewport = useCallback((newViewport: ViewportState) => {
    setViewport(newViewport);
  }, []);

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

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
        y: mousePointTo.y * newScale,
      });
    },
    [viewport, updateViewport]
  );

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

    // Process dropped files
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
  }, []);

  // Add to callback hooks
  const handleImageDelete = useCallback(() => {
    if (selectedId) {
      setImages((prev) => prev.filter((img) => img.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const clickedOnEmpty = e.target === stage;
    if (clickedOnEmpty) {
      setSelectedIds([]);
      setIsSelecting(true);
      const pos = stage.getPointerPosition();
      if (!pos) return;

      selectionStart.current = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };
      setSelectionRect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
      });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isSelecting || !selectionStart.current) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      setSelectionRect({
        x: Math.min(pos.x, selectionStart.current.x),
        y: Math.min(pos.y, selectionStart.current.y),
        width: Math.abs(pos.x - selectionStart.current.x),
        height: Math.abs(pos.y - selectionStart.current.y),
      });

      // Check intersections while dragging
      const selectedImages = images.filter((img) => {
        const imgRect = {
          x: img.x,
          y: img.y,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
        };

        return selectionRect
          ? imgRect.x < selectionRect.x + selectionRect.width &&
              imgRect.x + imgRect.width > selectionRect.x &&
              imgRect.y < selectionRect.y + selectionRect.height &&
              imgRect.y + imgRect.height > selectionRect.y
          : false;
      });

      setSelectedIds(selectedImages.map((img) => img.id));
    },
    [isSelecting, images, selectionRect]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    selectionStart.current = null;
    setSelectionRect(null);
  }, []);

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

    // Add event listeners directly to container
    container.addEventListener("dragover", handleDragOver, false);
    container.addEventListener("drop", handleDrop, false);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      // Clean up object URLs
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [handleDrop, objectUrls]);

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

  if (!mounted) {
    return null; // or loading state
  }

  return (
    <Stage
      ref={stageRef}
      width={stageDimensions.width}
      height={stageDimensions.height}
      draggable={!isSelecting}
      onWheel={handleWheel}
      x={viewport.x}
      y={viewport.y}
      scale={{ x: viewport.scale, y: viewport.scale }}
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
            url={img.url}
            x={img.x}
            y={img.y}
            isSelected={selectedIds.includes(img.id)}
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
    </Stage>
  );
};

export default Canva;
