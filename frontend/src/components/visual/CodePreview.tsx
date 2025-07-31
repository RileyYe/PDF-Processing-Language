import React, { useState } from 'react';

interface CodePreviewProps {
  command: string;
  onExecute: () => void;
}

const CodePreview: React.FC<CodePreviewProps> = ({ command, onExecute }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-ms-dark-850">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <div className="w-5 h-5 bg-green-500 rounded mr-3"></div>
          <h3 className="text-white font-medium">生成的代码</h3>
          <div className={`ml-3 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4 text-ms-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {command.trim() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="px-4 py-1.5 text-sm font-medium text-white bg-ms-blue border border-transparent rounded-md hover:bg-ms-blue-dark hover:shadow-ms-glow focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-850 transition-all duration-200"
          >
            执行
          </button>
        )}
      </div>

      {/* Code Content */}
      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="bg-ms-dark-900 rounded-lg p-4 border border-ms-dark-600">
            {command.trim() ? (
              <div className="space-y-2">
                {command.split('\n').map((line, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-ms-dark-500 text-xs font-mono mr-3 mt-0.5 min-w-[1.5rem] text-right">
                      {index + 1}
                    </span>
                    <code className="text-sm font-mono text-ms-blue flex-1 leading-relaxed">
                      {line || '\u00A0'}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-ms-dark-500 text-sm">
                  <div className="text-2xl mb-2">📝</div>
                  <div>在工作区拖拽积木块生成代码</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Command Info */}
          {command.trim() && (
            <div className="mt-3 flex items-center justify-between text-xs text-ms-dark-400">
              <div>
                行数: {command.split('\n').filter(line => line.trim()).length} | 
                字符数: {command.length}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigator.clipboard.writeText(command)}
                  className="flex items-center space-x-1 hover:text-ms-blue transition-colors duration-200"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>复制</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodePreview;