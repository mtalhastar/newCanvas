import React, { useState, useEffect } from 'react';
import { Image as KonvaImage, Transformer, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import type Konva from 'konva';

export interface DraggableImageProps {
  id: string;
  url: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isSelected: boolean;
  activeTool: string;
  onClick: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (id: string, newX: number, newY: number) => void;
  onResize: (id: string, width: number, height: number, x: number, y: number) => void;
}

const DraggableImage: React.FC<DraggableImageProps> = ({
  id,
  url,
  x,
  y,
  width: initialWidth,
  height: initialHeight,
  isSelected,
  activeTool,
  onClick,
  onDragEnd,
  onResize,
}) => {
  const [image] = useImage(url);
  const imageRef = React.useRef<Konva.Image>(null);
  const transformerRef = React.useRef<Konva.Transformer>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: initialWidth || 0,
    height: initialHeight || 0,
  });

  // Set initial dimensions when image loads
  useEffect(() => {
    if (image) {
      if (!initialWidth || !initialHeight) {
        setDimensions({
          width: image.width,
          height: image.height,
        });
      }
    }
  }, [image, initialWidth, initialHeight]);

  // Attach or detach transformer based on selection
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleTransformEnd = () => {
    const node = imageRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and update width/height instead
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(5, node.width() * scaleX);
    const newHeight = Math.max(5, node.height() * scaleY);

    setDimensions({
      width: newWidth,
      height: newHeight,
    });

    // Call onResize with the new dimensions and position
    onResize(id, newWidth, newHeight, node.x(), node.y());
  };

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    setIsDragging(true);
    e.target.moveToTop();
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    onDragEnd(id, e.target.x(), e.target.y());
  };

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    // Only trigger click if we weren't dragging
    if (!isDragging) {
      onClick(e);
    }
    setIsDragging(false);
  };

  return (
    <>
      <Group>
        <KonvaImage
          id={id}
          ref={imageRef}
          image={image}
          x={x}
          y={y}
          width={dimensions.width}
          height={dimensions.height}
          draggable={activeTool === "select"}
          onClick={handleClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
          perfectDrawEnabled={false}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            const minWidth = 5;
            const minHeight = 5;
            const maxWidth = 2000;
            const maxHeight = 2000;
            
            if (
              newBox.width < minWidth ||
              newBox.height < minHeight ||
              newBox.width > maxWidth ||
              newBox.height > maxHeight
            ) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
          ]}
          rotateEnabled={false}
          padding={5}
          anchorSize={10}
          anchorCornerRadius={5}
          borderStroke="#0096FF"
          anchorStroke="#0096FF"
          anchorFill="#fff"
          borderStrokeWidth={2}
          anchorStrokeWidth={2}
          keepRatio={false}
        />
      )}
    </>
  );
};

export default DraggableImage; 