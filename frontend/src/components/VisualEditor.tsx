import React, { useState, useCallback, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Toolbox from './visual/Toolbox';
import Workspace from './visual/Workspace';
import CodePreview from './visual/CodePreview';
import { BlockType, WorkspaceBlock, BlockDefinition } from '../types/visual';
import { uploadFile } from '../utils/api';

interface VisualEditorProps {
  onExecute: (command: string) => Promise<void>;
  className?: string;
  exampleBlocks?: any[];
}

const VisualEditor: React.FC<VisualEditorProps> = ({ onExecute, exampleBlocks, className = '' }) => {
  const [workspaceBlocks, setWorkspaceBlocks] = useState<WorkspaceBlock[]>([]);
  const [generatedCommand, setGeneratedCommand] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 积木块定义
  const blockDefinitions: BlockDefinition[] = [
    {
      type: 'load',
      category: 'input',
      label: 'Load',
      color: '#4A90E2',
      icon: '📄',
      description: '加载PDF文件',
      parameters: [
        { name: 'url', type: 'string', label: '文件URL', required: true, placeholder: 'https://example.com/document.pdf' }
      ],
      hasNext: true,
      hasPrevious: false
    },
    {
      type: 'select',
      category: 'filter',
      label: 'Select',
      color: '#7ED321',
      icon: '📋',
      description: '选择页面',
      parameters: [
        { name: 'mode', type: 'select', label: '模式', options: ['each'], placeholder: '自定义条件' },
        { name: 'pages', type: 'string', label: '页面范围', placeholder: '1..5 或 1 3 5 或 1..5 10 15..20' },
        { name: 'where', type: 'string', label: '条件', placeholder: '$page % 2 == 1' }
      ],
      hasNext: true,
      hasPrevious: true
    },
    {
      type: 'png',
      category: 'convert',
      label: 'PNG',
      color: '#F5A623',
      icon: '🖼️',
      description: '转换为PNG图片',
      parameters: [
        { name: 'dpi', type: 'number', label: 'DPI', placeholder: '300' }
      ],
      hasNext: true,
      hasPrevious: true
    },
    {
      type: 'concat',
      category: 'convert',
      label: 'Concat',
      color: '#9013FE',
      icon: '🔗',
      description: '合并页面',
      parameters: [],
      hasNext: true,
      hasPrevious: true
    },
    {
      type: 'save',
      category: 'output',
      label: 'Save',
      color: '#D0021B',
      icon: '💾',
      description: '保存文件',
      parameters: [
        { name: 'name', type: 'string', label: '文件名', required: true, placeholder: 'output' }
      ],
      hasNext: false,
      hasPrevious: true
    }
  ];

  // 添加积木块到工作区
  const addBlockToWorkspace = useCallback((blockType: BlockType, position: { x: number; y: number }) => {
    const definition = blockDefinitions.find(def => def.type === blockType);
    if (!definition) return;

    const newBlock: WorkspaceBlock = {
      id: `${blockType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: blockType,
      position,
      parameters: {},
      nextBlockId: null,
      previousBlockId: null
    };

    setWorkspaceBlocks(prev => [...prev, newBlock]);
  }, [blockDefinitions]);

  // 更新积木块参数
  const updateBlockParameter = useCallback((blockId: string, paramName: string, value: string) => {
    setWorkspaceBlocks(prev => prev.map(block => 
      block.id === blockId 
        ? { ...block, parameters: { ...block.parameters, [paramName]: value } }
        : block
    ));
  }, []);

  // 移动积木块
  const moveBlock = useCallback((blockId: string, position: { x: number; y: number }) => {
    setWorkspaceBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, position } : block
    ));
  }, []);

  // 连接积木块
  const connectBlocks = useCallback((sourceId: string, targetId: string) => {
    setWorkspaceBlocks(prev => prev.map(block => {
      if (block.id === sourceId) {
        // 如果source已经有next连接，先断开
        if (block.nextBlockId) {
          const oldNext = prev.find(b => b.id === block.nextBlockId);
          if (oldNext) {
            oldNext.previousBlockId = null;
          }
        }
        return { ...block, nextBlockId: targetId };
      }
      if (block.id === targetId) {
        // 如果target已经有previous连接，先断开
        if (block.previousBlockId) {
          const oldPrevious = prev.find(b => b.id === block.previousBlockId);
          if (oldPrevious) {
            oldPrevious.nextBlockId = null;
          }
        }
        return { ...block, previousBlockId: sourceId };
      }
      return block;
    }));
  }, []);

  // 断开积木块连接
  const disconnectBlocks = useCallback((blockId: string) => {
    setWorkspaceBlocks(prev => {
      const block = prev.find(b => b.id === blockId);
      if (!block) return prev;

      return prev.map(b => {
        if (b.id === blockId) {
          return { ...b, nextBlockId: null, previousBlockId: null };
        }
        if (b.nextBlockId === blockId) {
          return { ...b, nextBlockId: null };
        }
        if (b.previousBlockId === blockId) {
          return { ...b, previousBlockId: null };
        }
        return b;
      });
    });
  }, []);

  // 删除积木块
  const deleteBlock = useCallback((blockId: string) => {
    setWorkspaceBlocks(prev => {
      const blockToDelete = prev.find(b => b.id === blockId);
      if (!blockToDelete) return prev;

      // 断开连接
      const updatedBlocks = prev.map(block => {
        if (block.nextBlockId === blockId) {
          return { ...block, nextBlockId: blockToDelete.nextBlockId };
        }
        if (block.previousBlockId === blockId) {
          return { ...block, previousBlockId: blockToDelete.previousBlockId };
        }
        return block;
      });

      // 如果有前后连接，重新连接它们
      if (blockToDelete.previousBlockId && blockToDelete.nextBlockId) {
        return updatedBlocks.map(block => {
          if (block.id === blockToDelete.previousBlockId) {
            return { ...block, nextBlockId: blockToDelete.nextBlockId };
          }
          if (block.id === blockToDelete.nextBlockId) {
            return { ...block, previousBlockId: blockToDelete.previousBlockId };
          }
          return block;
        }).filter(block => block.id !== blockId);
      }

      return updatedBlocks.filter(block => block.id !== blockId);
    });
  }, []);

  // 生成代码
  const generateCommand = useCallback(() => {
    // 找到起始积木块（没有前驱的积木块）
    const startBlocks = workspaceBlocks.filter(block => !block.previousBlockId);
    
    if (startBlocks.length === 0) {
      setGeneratedCommand('');
      return;
    }

    // 为每个起始块生成命令链
    const commandChains = startBlocks.map(startBlock => {
      const chain: string[] = [];
      let currentBlock: WorkspaceBlock | undefined = startBlock;

      while (currentBlock) {
        const definition = blockDefinitions.find(def => def.type === currentBlock!.type);
        if (!definition) break;

        let blockCommand = definition.label;
        
        // 构建参数
        const params: string[] = [];
        definition.parameters.forEach(param => {
          const value = currentBlock!.parameters[param.name];
          if (value !== undefined && value !== '') {
            if (param.type === 'string') {
              params.push(`${param.name}:"${value}"`);
            } else {
              params.push(`${param.name}:${value}`);
            }
          }
        });

        if (params.length > 0) {
          blockCommand += `{${params.join(', ')}}`;
        } else if (definition.parameters.length > 0) {
          blockCommand += '{}';
        }

        chain.push(blockCommand);

        // 找到下一个积木块
        currentBlock = currentBlock.nextBlockId 
          ? workspaceBlocks.find(b => b.id === currentBlock!.nextBlockId)
          : undefined;
      }

      return chain.join(' | ');
    });

    const finalCommand = commandChains.join('\n');
    setGeneratedCommand(finalCommand);
  }, [workspaceBlocks, blockDefinitions]);

  // 当工作区积木块改变时重新生成命令
  React.useEffect(() => {
    generateCommand();
  }, [generateCommand]);

  // 处理示例积木块
  React.useEffect(() => {
    if (exampleBlocks && exampleBlocks.length > 0) {
      const timestamp = Date.now();
      
      // 创建新的积木块并建立连接
      const newBlocks: WorkspaceBlock[] = exampleBlocks.map((exampleBlock, index) => {
        const blockId = `${exampleBlock.type}-${timestamp}-${index}`;
        const nextBlockId = index < exampleBlocks.length - 1 
          ? `${exampleBlocks[index + 1].type}-${timestamp}-${index + 1}` 
          : null;
        const previousBlockId = index > 0 
          ? `${exampleBlocks[index - 1].type}-${timestamp}-${index - 1}` 
          : null;
          
        return {
          id: blockId,
          type: exampleBlock.type as BlockType,
          position: exampleBlock.position,
          parameters: exampleBlock.parameters,
          nextBlockId,
          previousBlockId
        };
      });
      
      setWorkspaceBlocks(newBlocks);
    } else if (exampleBlocks && exampleBlocks.length === 0) {
      // 如果传入空数组，清空工作区
      setWorkspaceBlocks([]);
    }
  }, [exampleBlocks]);

  // 清空工作区
  const clearWorkspace = useCallback(() => {
    setWorkspaceBlocks([]);
    setGeneratedCommand('');
  }, []);

  // 处理积木块高度变化时的位置调整
  const handleBlockHeightChange = useCallback((blockId: string, heightDelta: number) => {
    if (heightDelta === 0) return;

    // 找到所有下游积木块
    const findDownstreamBlocks = (currentBlockId: string): string[] => {
      const downstreamIds: string[] = [];
      const currentBlock = workspaceBlocks.find(b => b.id === currentBlockId);
      
      if (currentBlock?.nextBlockId) {
        downstreamIds.push(currentBlock.nextBlockId);
        downstreamIds.push(...findDownstreamBlocks(currentBlock.nextBlockId));
      }
      
      return downstreamIds;
    };

    const downstreamBlockIds = findDownstreamBlocks(blockId);
    
    if (downstreamBlockIds.length > 0) {
      setWorkspaceBlocks(prev => prev.map(block => {
        if (downstreamBlockIds.includes(block.id)) {
          return {
            ...block,
            position: {
              ...block.position,
              y: block.position.y + heightDelta
            }
          };
        }
        return block;
      }));
    }
  }, [workspaceBlocks]);

  // 执行命令
  const handleExecute = useCallback(async () => {
    if (!generatedCommand.trim()) {
      alert('请先在工作区构建命令');
      return;
    }
    await onExecute(generatedCommand);
  }, [generatedCommand, onExecute]);

  // 文件上传功能
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件大小
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过10MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadFile(file);
      
      if (result.success && result.download_url) {
        // 创建一个新的Load积木块
        const loadBlock: WorkspaceBlock = {
          id: `load-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'load',
          position: { x: 50, y: 50 }, // 默认位置
          parameters: { url: result.download_url },
          nextBlockId: null,
          previousBlockId: null
        };

        setWorkspaceBlocks(prev => [...prev, loadBlock]);
        alert(`文件上传成功！已自动创建Load积木块。文件ID: ${result.file_id}`);
      } else {
        alert(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : '文件上传失败');
    } finally {
      setIsUploading(false);
      // 清空文件输入，允许重复上传同一文件
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`bg-ms-dark-800 rounded-lg shadow-ms-dark overflow-hidden border border-ms-dark-700 ${className}`}>
        {/* Header */}
        <div className="bg-ms-dark-850 border-b border-ms-dark-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-ms-blue rounded-full mr-3 shadow-ms-glow"></div>
              <h2 className="text-lg font-semibold text-white">可视化编程</h2>
            </div>
            <div className="flex space-x-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                style={{ display: 'none' }}
              />
              <button 
                onClick={handleUploadClick}
                disabled={isUploading}
                className="px-4 py-2 h-11 text-sm font-medium text-ms-dark-300 bg-ms-dark-700 border border-ms-dark-600 rounded-md hover:bg-ms-dark-600 hover:border-ms-dark-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? '上传中...' : '上传文件'}
              </button>
              <button 
                onClick={clearWorkspace}
                disabled={isUploading}
                className="px-4 py-2 h-11 text-sm font-medium text-ms-dark-300 bg-ms-dark-700 border border-ms-dark-600 rounded-md hover:bg-ms-dark-600 hover:border-ms-dark-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                清空
              </button>
              <button 
                onClick={handleExecute}
                disabled={!generatedCommand.trim() || isUploading}
                className="px-6 py-2 h-11 text-sm font-medium text-white bg-ms-blue border border-transparent rounded-md hover:bg-ms-blue-dark hover:shadow-ms-glow focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                执行程序
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex h-128">
          {/* Toolbox */}
          <div className="w-64 bg-ms-dark-850 border-r border-ms-dark-700">
            <Toolbox 
              blockDefinitions={blockDefinitions}
              onBlockDrag={addBlockToWorkspace}
            />
          </div>

          {/* Workspace */}
          <div className="flex-1 relative bg-ms-dark-900">
            <Workspace
              ref={workspaceRef}
              blocks={workspaceBlocks}
              blockDefinitions={blockDefinitions}
              onBlockMove={moveBlock}
              onBlockConnect={connectBlocks}
              onBlockDisconnect={disconnectBlocks}
              onBlockDelete={deleteBlock}
              onParameterChange={updateBlockParameter}
              onBlockDrop={addBlockToWorkspace}
              onBlockHeightChange={handleBlockHeightChange}
            />
          </div>
        </div>

        {/* Code Preview */}
        <div className="border-t border-ms-dark-700">
          <CodePreview 
            command={generatedCommand}
            onExecute={handleExecute}
          />
        </div>
      </div>
    </DndProvider>
  );
};

export default VisualEditor;