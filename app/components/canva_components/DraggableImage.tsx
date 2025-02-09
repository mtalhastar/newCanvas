import React from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';

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

const DraggableImage: React.FC<DraggableImageProps> = ({
  id,
  url,
  x,
  y,
  isSelected,
  selectedIds,
  onClick,
  onDragEnd,
}) => {
  const [image] = useImage(url);

  return (
    <>
      <KonvaImage
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

export default DraggableImage; 