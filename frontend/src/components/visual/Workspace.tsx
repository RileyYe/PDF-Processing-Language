import React, { forwardRef } from 'react';
import { useDrop } from 'react-dnd';
import WorkspaceBlock from './WorkspaceBlock';
import { BlockDefinition, WorkspaceBlock as WorkspaceBlockType, BlockType, DragItem } from '../../types/visual';

interface WorkspaceProps {
  blocks: WorkspaceBlockType[];
  blockDefinitions: BlockDefinition[];
  onBlockMove: (blockId: string, position: { x: number; y: number }) => void;
  onBlockConnect: (sourceId: string, targetId: string) => void;
  onBlockDisconnect: (blockId: string) => void;
  onBlockDelete: (blockId: string) => void;
  onParameterChange: (blockId: string, paramName: string, value: string) => void;
  onBlockDrop: (blockType: BlockType, position: { x: number; y: number }) => void;
}

const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>(({
  blocks,
  blockDefinitions,
  onBlockMove,
  onBlockConnect,
  onBlockDisconnect,
  onBlockDelete,
  onParameterChange,
  onBlockDrop
}, ref) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'BLOCK',
    drop: (item: DragItem, monitor) => {
      if (!monitor.didDrop()) {
        const offset = monitor.getClientOffset();
        const workspaceElement = (ref as React.RefObject<HTMLDivElement>)?.current;
        
        if (offset && workspaceElement) {
          const workspaceRect = workspaceElement.getBoundingClientRect();
          const position = {
            x: offset.x - workspaceRect.left - 90, // 减去积木块宽度的一半
            y: offset.y - workspaceRect.top - 35   // 减去积木块高度的一半
          };
          
          if (item.isFromToolbox) {
            // 从工具栏拖拽新积木块
            onBlockDrop(item.blockType, position);
          } else if (item.blockId) {
            // 移动现有积木块
            onBlockMove(item.blockId, position);
            
            // 检查是否可以自动连接
            checkAutoConnect(item.blockId, position);
          }
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // 自动连接检测
  const checkAutoConnect = (draggedBlockId: string, newPosition: { x: number; y: number }) => {
    const draggedBlock = blocks.find(b => b.id === draggedBlockId);
    if (!draggedBlock) return;

    const draggedDefinition = blockDefinitions.find(def => def.type === draggedBlock.type);
    if (!draggedDefinition) return;

    const SNAP_DISTANCE = 80; // 增加吸附距离
    let bestConnection: { targetId: string; position: { x: number; y: number }; type: 'next' | 'previous' } | null = null;
    let minDistance = Infinity;
    
    blocks.forEach(targetBlock => {
      if (targetBlock.id === draggedBlockId) return;
      
      const targetDefinition = blockDefinitions.find(def => def.type === targetBlock.type);
      if (!targetDefinition) return;

      // 检查连接到目标积木块后面
      if (draggedDefinition.hasPrevious && 
          targetDefinition.hasNext && 
          !targetBlock.nextBlockId &&
          !draggedBlock.previousBlockId) {
        
        const snapPosition = {
          x: targetBlock.position.x,
          y: targetBlock.position.y + 80 // 积木块高度 + 间距
        };
        
        const distance = Math.sqrt(
          Math.pow(newPosition.x - snapPosition.x, 2) +
          Math.pow(newPosition.y - snapPosition.y, 2)
        );

        if (distance < SNAP_DISTANCE && distance < minDistance) {
          minDistance = distance;
          bestConnection = {
            targetId: targetBlock.id,
            position: snapPosition,
            type: 'next'
          };
        }
      }

      // 检查连接到目标积木块前面
      if (draggedDefinition.hasNext && 
          targetDefinition.hasPrevious && 
          !draggedBlock.nextBlockId &&
          !targetBlock.previousBlockId) {
        
        const snapPosition = {
          x: targetBlock.position.x,
          y: targetBlock.position.y - 80 // 积木块高度 + 间距
        };
        
        const distance = Math.sqrt(
          Math.pow(newPosition.x - snapPosition.x, 2) +
          Math.pow(newPosition.y - snapPosition.y, 2)
        );

        if (distance < SNAP_DISTANCE && distance < minDistance) {
          minDistance = distance;
          bestConnection = {
            targetId: targetBlock.id,
            position: snapPosition,
            type: 'previous'
          };
        }
      }
    });

    // 执行最佳连接
    if (bestConnection) {
      onBlockMove(draggedBlockId, bestConnection.position);
      
      if (bestConnection.type === 'next') {
        onBlockConnect(bestConnection.targetId, draggedBlockId);
      } else {
        onBlockConnect(draggedBlockId, bestConnection.targetId);
      }
    }
  };

  const combinedRef = React.useCallback((node: HTMLDivElement) => {
    drop(node);
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        ref.current = node;
      }
    }
  }, [drop, ref]);

  // 渲染连接线
  const renderConnections = () => {
    return blocks.map(block => {
      if (!block.nextBlockId) return null;
      
      const nextBlock = blocks.find(b => b.id === block.nextBlockId);
      if (!nextBlock) return null;

      const startX = block.position.x + 150; // 积木块宽度的一半
      const startY = block.position.y + 40;  // 积木块高度的一半
      const endX = nextBlock.position.x + 150;
      const endY = nextBlock.position.y + 40;

      return (
        <svg
          key={`connection-${block.id}-${block.nextBlockId}`}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          <defs>
            <marker
              id={`arrowhead-${block.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#4A90E2"
              />
            </marker>
          </defs>
          <path
            d={`M ${startX} ${startY} Q ${startX + 50} ${startY} ${startX + 50} ${(startY + endY) / 2} Q ${startX + 50} ${endY} ${endX} ${endY}`}
            stroke="#4A90E2"
            strokeWidth="3"
            fill="none"
            markerEnd={`url(#arrowhead-${block.id})`}
            className="opacity-80"
          />
        </svg>
      );
    });
  };

  return (
    <div
      ref={combinedRef}
      className={`w-full h-full relative overflow-hidden ${
        isOver ? 'bg-ms-dark-800' : 'bg-ms-dark-900'
      } transition-colors duration-200`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)
        `,
        backgroundSize: '20px 20px'
      }}
    >
      {/* Drop Zone Indicator */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-dashed border-ms-blue bg-ms-blue bg-opacity-10 flex items-center justify-center z-10">
          <div className="text-ms-blue text-lg font-semibold bg-ms-dark-800 px-6 py-3 rounded-lg shadow-lg border border-ms-blue">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              将积木块拖放到此处
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {blocks.length === 0 && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-ms-dark-500 max-w-md">
            <div className="text-4xl mb-4">🧩</div>
            <div className="text-lg font-medium mb-3">从左侧拖拽积木块开始编程</div>
            <div className="space-y-2 text-sm text-left bg-ms-dark-800 rounded-lg p-4 border border-ms-dark-700">
              <div className="text-white font-medium mb-2">💡 使用技巧：</div>
              <div className="flex items-center text-ms-dark-300">
                <span className="text-green-400 mr-2">•</span>
                从工具栏拖拽积木块到这里
              </div>
              <div className="flex items-center text-ms-dark-300">
                <span className="text-blue-400 mr-2">•</span>
                拖拽积木块靠近其他积木块自动连接
              </div>
              <div className="flex items-center text-ms-dark-300">
                <span className="text-yellow-400 mr-2">•</span>
                点击积木块展开参数设置
              </div>
              <div className="flex items-center text-ms-dark-300">
                <span className="text-purple-400 mr-2">•</span>
                底部实时显示生成的代码
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connections */}
      {renderConnections()}

      {/* Blocks */}
      {blocks.map(block => {
        const definition = blockDefinitions.find(def => def.type === block.type);
        if (!definition) return null;

        return (
                      <WorkspaceBlock
              key={block.id}
              block={block}
              definition={definition}
              onMove={onBlockMove}
              onDelete={onBlockDelete}
              onParameterChange={onParameterChange}
              onConnect={onBlockConnect}
              onDisconnect={onBlockDisconnect}
              allBlocks={blocks}
            />
        );
      })}
    </div>
  );
});

Workspace.displayName = 'Workspace';

export default Workspace;