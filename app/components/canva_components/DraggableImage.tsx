import React, { useState, useEffect } from 'react';
import { Image as KonvaImage, Rect, Transformer, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';

interface DraggableImageProps {
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
  onResize: (id: string, newWidth: number, newHeight: number, newX: number, newY: number) => void;
  onDelete: () => void;
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
  const imageRef = React.useRef<any>(null);
  const transformerRef = React.useRef<any>(null);
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

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
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

    onResize(id, newWidth, newHeight, node.x(), node.y());
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
          onClick={onClick}
          onDragStart={(e) => {
            e.target.moveToTop();
          }}
          onDragEnd={(e) => {
            onDragEnd(id, e.target.x(), e.target.y());
          }}
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
            const maxWidth = 1000;
            const maxHeight = 1000;
            
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
            'top-left', 'top-right',
            'bottom-left', 'bottom-right'
          ]}
          rotateEnabled={false}
        />
      )}
    </>
  );
};

export default DraggableImage; 