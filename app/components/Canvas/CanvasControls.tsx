import React from 'react';

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPan: (dx: number, dy: number) => void;
}

const CanvasControls: React.FC<CanvasControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onPan,
}) => {
  const PAN_AMOUNT = 50;

  return (
    <div
      className="absolute bottom-5 right-5 flex flex-col gap-2 bg-white p-3 rounded-lg shadow-md"
    >
      <div className="flex gap-1">
        <button
          onClick={onZoomIn}
          className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
        >
          +
        </button>
        <button
          onClick={onZoomOut}
          className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
        >
          -
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={() => onPan(PAN_AMOUNT, 0)}
          className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
        >
          ←
        </button>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onPan(0, PAN_AMOUNT)}
            className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
          >
            ↑
          </button>
          <button
            onClick={() => onPan(0, -PAN_AMOUNT)}
            className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
          >
            ↓
          </button>
        </div>
        <button
          onClick={() => onPan(-PAN_AMOUNT, 0)}
          className="p-1 px-3 hover:bg-gray-100 rounded cursor-pointer"
        >
          →
        </button>
      </div>
    </div>
  );
};

export default CanvasControls; 