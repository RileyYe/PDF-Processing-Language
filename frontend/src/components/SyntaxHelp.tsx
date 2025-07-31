import React from 'react';
import { SyntaxHelpProps } from '@/types';
import { useToggle } from '../hooks/useToggle';

const SyntaxHelp: React.FC<SyntaxHelpProps> = ({ className = '' }) => {
  const { value: isExpanded, toggle } = useToggle(false);

  return (
    <div className={`mb-8 ${className}`}>
      <div 
        className="flex items-center mb-6 cursor-pointer select-none" 
        onClick={toggle}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mr-3 shadow-ms-glow">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white flex-1">语法帮助</h2>
        <div 
          className={`ml-3 transform transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
        >
          <svg className="w-5 h-5 text-ms-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
      
      {isExpanded && (
        <div className="bg-ms-dark-800 rounded-lg p-6 border border-ms-dark-700 shadow-ms-dark transition-all duration-300 ease-in-out">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本语法 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <div className="w-5 h-5 bg-ms-blue rounded mr-2"></div>
                基本语法
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-ms-blue font-mono mb-1">操作符{'{参数:值}'} | 下一个操作符</p>
                  <p className="text-ms-dark-300">管道操作符 <span className="text-white font-mono">|</span> 连接多个处理步骤</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-ms-blue font-mono mb-1">Load{'{url:"文件路径"}'}</p>
                  <p className="text-ms-dark-300">加载PDF文件，支持本地路径和URL</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-ms-blue font-mono mb-1">Save{'{name:"输出名称"}'}</p>
                  <p className="text-ms-dark-300">保存处理结果到指定文件</p>
                </div>
              </div>
            </div>

            {/* 页面选择 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <div className="w-5 h-5 bg-green-500 rounded mr-2"></div>
                页面选择
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-green-400 font-mono mb-1">Select{'{pages:"1..5"}'}</p>
                  <p className="text-ms-dark-300">选择页面范围（第1到5页）</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-green-400 font-mono mb-1">Select{'{pages:"1 3 5"}'}</p>
                  <p className="text-ms-dark-300">选择特定页面（第1、3、5页）</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-green-400 font-mono mb-1">Select{'{where:"$page % 2 == 1"}'}</p>
                  <p className="text-ms-dark-300">条件选择（奇数页）</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-green-400 font-mono mb-1">Select{'{mode:"each"}'}</p>
                  <p className="text-ms-dark-300">选择每一页，等价于Select{'{pages:"1..$total"}'}，也等价于 Select{'{where: "$page > 0"}'}</p>
                </div>
              </div>
            </div>

            {/* 格式转换 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <div className="w-5 h-5 bg-yellow-500 rounded mr-2"></div>
                格式转换
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-yellow-400 font-mono mb-1">PNG{'{dpi:300}'}</p>
                  <p className="text-ms-dark-300">转换为PNG图片，指定DPI</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-yellow-400 font-mono mb-1">Concat</p>
                  <p className="text-ms-dark-300">合并多个页面为单个文件</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-yellow-400 font-mono mb-1">Select{'{mode:"each"}'} | PNG | Concat</p>
                  <p className="text-ms-dark-300">分离页面，转换为PNG，然后合并为单个图片</p>
                </div>
              </div>
            </div>

            {/* 变量和函数 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <div className="w-5 h-5 bg-red-500 rounded mr-2"></div>
                变量和函数
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-red-400 font-mono mb-1">$page</p>
                  <p className="text-ms-dark-300">当前页码（从1开始）</p>
                </div>
                <div className="bg-ms-dark-700 rounded-md p-3 border border-ms-dark-600">
                  <p className="text-red-400 font-mono mb-1">$total</p>
                  <p className="text-ms-dark-300">总页数</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 完整示例 */}
          <div className="mt-6 pt-6 border-t border-ms-dark-600">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <div className="w-5 h-5 bg-purple-500 rounded mr-2"></div>
              完整示例
            </h3>
            <div className="bg-ms-dark-900 rounded-lg p-4 border border-ms-dark-600">
              <div className="font-mono text-sm text-ms-blue leading-relaxed">
                <div>Load{'{url:"document.pdf"}'}</div>
                <div className="text-ms-dark-400">  | Select{'{where:"$page > 2 && $page < $total - 1"}'}</div>
                <div className="text-ms-dark-400">  | Concat</div>
                <div className="text-ms-dark-400">  | PNG{'{dpi:300}'}</div>
                <div className="text-ms-dark-400">  | Save{'{name:"我的图片"}'}</div>
              </div>
              <p className="text-ms-dark-300 text-sm mt-3">
                加载PDF → 选择中间页面（排除前2页和最后1页）→ 合并 → 转换为高分辨率PNG → 保存并命名为"我的图片"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyntaxHelp;