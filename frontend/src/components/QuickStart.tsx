import React from 'react';
import { QuickStartProps, UsageExample } from '@/types';
import VisualQuickStart from './visual/VisualQuickStart';

const QuickStart: React.FC<QuickStartProps & { mode?: 'text' | 'visual'; onVisualExample?: (blocks: any[]) => void }> = ({ 
  onExampleClick, 
  mode = 'text', 
  onVisualExample,
  className = '' 
}) => {
  const examples: UsageExample[] = [
    {
      id: 'pdf-to-image',
      title: 'PDF转图片',
      description: '将PDF的每一页都转换为PNG图片',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{mode:"each"} | PNG{dpi:300} | Save{name:"pages"}',
      color: 'blue',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
      ),
    },
    {
      id: 'odd-pages',
      title: '提取奇数页',
      description: '提取所有奇数页并合并为新PDF',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{where:"$page % 2 == 1"} | Concat | Save{name:"odd_pages"}',
      color: 'green',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
      ),
    },
    {
      id: 'page-range',
      title: '指定页面范围',
      description: '提取指定的页面范围和页码',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{pages:"1..5 10 15..20"} | Save{name:"selected_pages"}',
      color: 'yellow',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
      ),
    },
    {
      id: 'cover-back',
      title: '封面封底',
      description: '只提取首页和最后一页',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{pages:"1 $total"} | Save{name:"cover_back"}',
      color: 'purple',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      ),
    },
    {
      id: 'high-res',
      title: '高分辨率合并图',
      description: '分离每页后转换为PNG，然后合并为单张图片',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{mode:"each"} | PNG{dpi:600} | Concat | Save{name:"high_res_image"}',
      color: 'red',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
      ),
    },
    {
      id: 'conditional',
      title: '条件筛选',
      description: '按复杂条件筛选中间页面',
      command: 'Load{url:"https://example.com/document.pdf"} | Select{where:"$page > 5 && $page < $total - 2"} | Concat | Save{name:"middle_pages"}',
      color: 'indigo',
      icon: (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
        </svg>
      ),
    },
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      purple: 'bg-purple-500',
      red: 'bg-red-500',
      indigo: 'bg-indigo-500',
    };
    return colorMap[color] || 'bg-blue-500';
  };

  const handleCardClick = (example: UsageExample) => {
    onExampleClick(example.command);
  };

  // 如果是可视化模式，显示可视化快速开始
  if (mode === 'visual') {
    return (
      <VisualQuickStart 
        onExampleSelect={onVisualExample}
        className={className}
      />
    );
  }

  // 文本模式显示原来的快速开始
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center mb-6">
        <div className="w-8 h-8 bg-ms-blue rounded-lg flex items-center justify-center mr-3 shadow-ms-glow">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">快速开始</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {examples.map((example) => (
          <div
            key={example.id}
            className="usage-card bg-ms-dark-800 rounded-lg p-4 border border-ms-dark-700 hover:border-ms-blue cursor-pointer hover:shadow-ms-glow"
            onClick={() => handleCardClick(example)}
          >
            <div className="flex items-center mb-3">
              <div className={`w-6 h-6 ${getColorClasses(example.color)} rounded-md flex items-center justify-center mr-3`}>
                {example.icon}
              </div>
              <h3 className="text-white font-medium">{example.title}</h3>
            </div>
            <p className="text-ms-dark-300 text-sm">{example.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickStart;