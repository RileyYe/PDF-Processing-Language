import React from 'react';

interface ConnectionPreviewProps {
  isVisible: boolean;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  color?: string;
}

const ConnectionPreview: React.FC<ConnectionPreviewProps> = ({
  isVisible,
  startPosition,
  endPosition,
  color = '#4A90E2'
}) => {
  if (!isVisible) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{ 
        width: '100%', 
        height: '100%', 
        zIndex: 999 
      }}
    >
      <defs>
        <marker
          id="connection-preview-arrow"
          markerWidth="12"
          markerHeight="8"
          refX="10"
          refY="4"
          orient="auto"
        >
          <polygon
            points="0 0, 12 4, 0 8"
            fill={color}
            opacity="0.8"
          />
        </marker>
      </defs>
      <path
        d={`M ${startPosition.x} ${startPosition.y} Q ${startPosition.x + 50} ${startPosition.y} ${startPosition.x + 50} ${(startPosition.y + endPosition.y) / 2} Q ${startPosition.x + 50} ${endPosition.y} ${endPosition.x} ${endPosition.y}`}
        stroke={color}
        strokeWidth="4"
        fill="none"
        markerEnd="url(#connection-preview-arrow)"
        opacity="0.6"
        strokeDasharray="8 4"
        className="animate-pulse"
      />
      
      {/* 连接点高亮 */}
      <circle
        cx={startPosition.x}
        cy={startPosition.y}
        r="6"
        fill={color}
        opacity="0.8"
        className="animate-ping"
      />
      <circle
        cx={endPosition.x}
        cy={endPosition.y}
        r="6"
        fill={color}
        opacity="0.8"
        className="animate-ping"
      />
    </svg>
  );
};

export default ConnectionPreview;