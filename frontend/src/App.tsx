import React, { useState, useRef } from 'react';
import SyntaxHelp from './components/SyntaxHelp';
import QuickStart from './components/QuickStart';
import Editor from './components/Editor';
import VisualEditor from './components/VisualEditor';
import Modal from './components/Modal';
import LoadingOverlay from './components/LoadingOverlay';
import { executeCommand } from './utils/api';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'text' | 'visual'>('text');
  const [visualExampleBlocks, setVisualExampleBlocks] = useState<any[]>([]);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    isError: boolean;
    downloadUrl?: string;
    fileName?: string;
  }>({
    title: '',
    message: '',
    isError: false,
  });
  
  // 编辑器引用，用于从外部设置内容
  const editorRef = useRef<{ setValue: (value: string) => void; insertTextAtCursor: (text: string) => void } | null>(null);

  const handleExampleClick = (example: string) => {
    if (editorRef.current) {
      editorRef.current.setValue(example);
    }
  };

  const handleVisualExample = (blocks: any[]) => {
    // 先清空之前的积木块
    setVisualExampleBlocks([]);
    
    // 延迟设置新的积木块，确保清空操作完成
    setTimeout(() => {
      setVisualExampleBlocks(blocks);
    }, 100);
    
    // 切换到可视化编程模式（如果还没有的话）
    if (editorMode !== 'visual') {
      setEditorMode('visual');
    }
  };

  const handleExecute = async (command: string) => {
    setIsLoading(true);
    
    try {
      const result = await executeCommand(command);
      
      if (result.success) {
        let message = result.message || '命令执行成功！';
        let downloadUrl: string | undefined;
        
        if (result.output_file) {
          // 优先使用OSS下载链接，如果没有则使用本地下载
          downloadUrl = result.download_url || `/api/download/${result.output_file}`;
          
          if (result.download_url) {
            message += `\n\n文件已上传到云端，点击下方按钮下载结果文件。`;
          } else {
            message += `\n\n文件已生成，点击下方按钮下载结果文件。`;
          }
        }
        
        setModalContent({
          title: '执行成功',
          message,
          isError: false,
          downloadUrl,
          fileName: result.output_file,
        });
      } else {
        setModalContent({
          title: '执行失败',
          message: result.error || '命令执行失败',
          isError: true,
        });
      }
      setIsModalOpen(true);
    } catch (error) {
      setModalContent({
        title: '执行错误',
        message: error instanceof Error ? error.message : '未知错误',
        isError: true,
      });
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen">
      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Syntax Help */}
        <SyntaxHelp />

        {/* Editor Mode Toggle */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex bg-ms-dark-800 rounded-lg p-1 border border-ms-dark-700">
              <button
                onClick={() => setEditorMode('text')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  editorMode === 'text'
                    ? 'bg-ms-blue text-white shadow-ms-glow'
                    : 'text-ms-dark-300 hover:text-white hover:bg-ms-dark-700'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3" />
                  </svg>
                  文本编辑器
                </div>
              </button>
              <button
                onClick={() => setEditorMode('visual')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  editorMode === 'visual'
                    ? 'bg-ms-blue text-white shadow-ms-glow'
                    : 'text-ms-dark-300 hover:text-white hover:bg-ms-dark-700'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  可视化编程
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Start Examples */}
        <QuickStart 
          mode={editorMode}
          onExampleClick={handleExampleClick}
          onVisualExample={handleVisualExample}
        />

        {/* Editor */}
        {editorMode === 'text' ? (
          <Editor ref={editorRef} onExecute={handleExecute} />
        ) : (
          <VisualEditor 
            onExecute={handleExecute} 
            exampleBlocks={visualExampleBlocks}
          />
        )}
      </div>

      {/* Result Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={modalContent.title}
        downloadUrl={modalContent.downloadUrl}
        fileName={modalContent.fileName}
      >
        <div className={`text-sm leading-relaxed ${
          modalContent.isError ? 'text-red-300' : 'text-ms-dark-200'
        }`}>
          {modalContent.message}
        </div>
      </Modal>

      {/* Loading Overlay */}
      <LoadingOverlay isLoading={isLoading} />
    </div>
  );
};

export default App;