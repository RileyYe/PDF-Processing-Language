import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { BlockDefinition, WorkspaceBlock as WorkspaceBlockType } from '../../types/visual';

interface WorkspaceBlockProps {
  block: WorkspaceBlockType;
  definition: BlockDefinition;
  onMove: (blockId: string, position: { x: number; y: number }) => void;
  onDelete: (blockId: string) => void;
  onParameterChange: (blockId: string, paramName: string, value: string) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onDisconnect: (blockId: string) => void;
  allBlocks: WorkspaceBlockType[];
}

const WorkspaceBlock: React.FC<WorkspaceBlockProps> = ({
  block,
  definition,
  onMove,
  onDelete,
  onParameterChange,
  onConnect,
  onDisconnect,
  allBlocks
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: 'BLOCK',
    item: { 
      type: 'BLOCK', 
      blockType: definition.type, 
      blockId: block.id,
      isFromToolbox: false 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      // 拖拽结束后的处理
      if (!monitor.didDrop()) {
        // 如果没有成功拖拽到目标位置，可以添加一些反馈
      }
    }
  });

  // 处理参数变化
  const handleParameterChange = (paramName: string, value: string) => {
    onParameterChange(block.id, paramName, value);
  };

  // 渲染参数输入
  const renderParameterInput = (param: typeof definition.parameters[0]) => {
    const value = block.parameters[param.name] || '';

    switch (param.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full px-2 py-1 text-xs bg-ms-dark-700 border border-ms-dark-600 rounded text-white focus:outline-none focus:border-ms-blue"
          >
            <option value="">{param.placeholder || '选择...'}</option>
            {param.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            className="w-full px-2 py-1 text-xs bg-ms-dark-700 border border-ms-dark-600 rounded text-white focus:outline-none focus:border-ms-blue"
          />
        );
      
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleParameterChange(param.name, e.target.checked ? 'true' : 'false')}
              className="mr-2"
            />
            <span className="text-xs text-white">{param.label}</span>
          </label>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            className="w-full px-2 py-1 text-xs bg-ms-dark-700 border border-ms-dark-600 rounded text-white focus:outline-none focus:border-ms-blue"
          />
        );
    }
  };

  // 获取可连接的积木块 (暂未使用)
  // const getConnectableBlocks = () => {
  //   if (!definition.hasNext) return [];
  //   
  //   return allBlocks.filter(otherBlock => {
  //     // 需要从外部传入所有积木块定义来判断
  //     return otherBlock.id !== block.id && 
  //            !otherBlock.previousBlockId;
  //   });
  // };

  return (
    <div
      className={`absolute transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-105 cursor-grabbing' : 'cursor-grab hover:scale-105'
      }`}
      style={{
        left: block.position.x,
        top: block.position.y,
        zIndex: isDragging ? 1000 : 2
      }}
      onMouseEnter={() => setShowConnectors(true)}
      onMouseLeave={() => setShowConnectors(false)}
    >
      <div
        ref={drag}
        className={`workspace-block bg-ms-dark-800 border-2 rounded-lg shadow-lg min-w-[180px] max-w-[250px] transition-all duration-200 ${
          isDragging ? 'shadow-2xl' : 'hover:shadow-xl'
        }`}
        style={{
          borderColor: definition.color,
          boxShadow: isDragging 
            ? `0 8px 32px ${definition.color}60, 0 0 0 2px ${definition.color}40`
            : `0 4px 12px ${definition.color}30`
        }}
      >
        {/* Block Header */}
        <div 
          className="flex items-center justify-between p-3 rounded-t-lg"
          style={{ backgroundColor: definition.color + '20' }}
        >
          <div className="flex items-center flex-1">
            <span className="text-lg mr-2" role="img" aria-label={definition.label}>
              {definition.icon}
            </span>
            <span 
              className="font-semibold"
              style={{ color: definition.color }}
            >
              {definition.label}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {definition.parameters.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-white hover:text-ms-blue transition-colors duration-200"
              >
                <svg 
                  className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            
            {(block.nextBlockId || block.previousBlockId) && (
              <button
                onClick={() => onDisconnect(block.id)}
                className="text-yellow-400 hover:text-yellow-300 transition-colors duration-200 mr-2"
                title="断开连接"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            )}
            
            <button
              onClick={() => onDelete(block.id)}
              className="text-red-400 hover:text-red-300 transition-colors duration-200"
              title="删除积木块"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Parameters */}
        {isExpanded && definition.parameters.length > 0 && (
          <div className="p-3 border-t border-ms-dark-600 space-y-3">
            {definition.parameters.map(param => (
              <div key={param.name} className="space-y-1">
                <label className="block text-xs font-medium text-ms-dark-300">
                  {param.label}
                  {param.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderParameterInput(param)}
              </div>
            ))}
          </div>
        )}

        {/* Connection Points */}
        {showConnectors && (
          <>
            {/* Previous Connection Point */}
            {definition.hasPrevious && !block.previousBlockId && (
              <div 
                className="absolute left-0 top-1/2 transform -translate-x-2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white opacity-80 hover:opacity-100 cursor-pointer animate-pulse"
                title="可连接输入"
              />
            )}
            
            {/* Next Connection Point */}
            {definition.hasNext && !block.nextBlockId && (
              <div 
                className="absolute right-0 top-1/2 transform translate-x-2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white opacity-80 hover:opacity-100 cursor-pointer animate-pulse"
                title="可连接输出"
              />
            )}
          </>
        )}

        {/* Connection Status Indicators */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex">
          {block.previousBlockId && (
            <div className="flex-1 bg-green-500 rounded-bl-lg opacity-80" title="已连接输入" />
          )}
          {block.nextBlockId && (
            <div className="flex-1 bg-green-500 rounded-br-lg opacity-80" title="已连接输出" />
          )}
        </div>

        {/* Drag Handle */}
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-ms-dark-500 rounded-full opacity-50"></div>
          <div className="w-2 h-2 bg-ms-dark-500 rounded-full opacity-50 mt-1"></div>
          <div className="w-2 h-2 bg-ms-dark-500 rounded-full opacity-50 mt-1"></div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceBlock;