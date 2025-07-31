import React from 'react';
import { useDrag } from 'react-dnd';
import { BlockDefinition, BlockType, BlockCategory } from '../../types/visual';

interface ToolboxProps {
  blockDefinitions: BlockDefinition[];
  onBlockDrag: (blockType: BlockType, position: { x: number; y: number }) => void;
}

const Toolbox: React.FC<ToolboxProps> = ({ blockDefinitions }) => {
  // 按类别分组积木块
  const groupedBlocks = React.useMemo(() => {
    const groups: Record<BlockCategory, BlockDefinition[]> = {
      input: [],
      filter: [],
      convert: [],
      output: [],
      control: []
    };

    blockDefinitions.forEach(block => {
      groups[block.category].push(block);
    });

    return groups;
  }, [blockDefinitions]);

  const categoryLabels: Record<BlockCategory, string> = {
    input: '输入',
    filter: '筛选',
    convert: '转换',
    output: '输出',
    control: '控制'
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-white font-semibold mb-4 flex items-center">
        <span className="mr-2">🧩</span>
        积木块
      </h3>
      
        <div className="space-y-4">
          {Object.entries(groupedBlocks).map(([category, blocks]) => {
            if (blocks.length === 0) return null;
            
            return (
              <div key={category} className="space-y-2">
                <h4 className="text-ms-dark-300 text-sm font-medium">
                  {categoryLabels[category as BlockCategory]}
                </h4>
                <div className="space-y-2">
                  {blocks.map(block => (
                    <ToolboxBlock key={block.type} definition={block} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
};

interface ToolboxBlockProps {
  definition: BlockDefinition;
}

const ToolboxBlock: React.FC<ToolboxBlockProps> = ({ definition }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'BLOCK',
    item: { 
      type: 'BLOCK', 
      blockType: definition.type, 
      isFromToolbox: true 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`block-toolbox cursor-grab active:cursor-grabbing p-3 rounded-lg border-2 border-opacity-20 hover:border-opacity-40 transition-all duration-200 ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: definition.color + '20',
        borderColor: definition.color,
        boxShadow: isDragging ? `0 0 20px ${definition.color}40` : ''
      }}
    >
      <div className="flex items-center mb-2">
        <span className="text-lg mr-2" role="img" aria-label={definition.label}>
          {definition.icon}
        </span>
        <span 
          className="font-semibold text-sm"
          style={{ color: definition.color }}
        >
          {definition.label}
        </span>
      </div>
      <p className="text-xs text-ms-dark-300 leading-relaxed">
        {definition.description}
      </p>
      
      {/* 参数预览 */}
      {definition.parameters.length > 0 && (
        <div className="mt-2 pt-2 border-t border-ms-dark-600">
          <div className="text-xs text-ms-dark-400">
            参数: {definition.parameters.map(p => p.label).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbox;