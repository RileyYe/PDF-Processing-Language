import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { EditorProps } from '../types';
import { uploadFile } from '../utils/api';

interface EditorRef {
  setValue: (value: string) => void;
  insertTextAtCursor: (text: string) => void;
}

const CodeEditor = forwardRef<EditorRef, EditorProps>(({ onExecute, className = '' }, ref) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 在Monaco Editor加载之前配置语言和主题
  const handleEditorWillMount = (monaco: any) => {
    // 注册PDF-PL语言
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'pdfl')) {
      monaco.languages.register({ id: 'pdfl' });
      
      // 设置语法高亮规则
      monaco.languages.setMonarchTokensProvider('pdfl', {
        tokenizer: {
          root: [
            // PDF-PL命令关键词
            [/\b(Load|Select|Concat|PNG|Save)\b/, 'keyword.command'],
            
            // 参数名称
            [/\b(url|mode|pages|where|dpi|name)\b/, 'keyword.parameter'],
            
            // 字符串值（带引号）
            [/"[^"]*"/, 'string.value'],
            [/'[^']*'/, 'string.value'],
            
            // 特殊值
            [/\b(each|all|true|false)\b/, 'keyword.special'],
            
            // 变量
            [/\$\w+/, 'variable'],
            
            // 管道符
            [/\|/, 'operator.pipe'],
            
            // 冒号 (参数赋值)
            [/:/, 'operator.assign'],
            
            // 花括号
            [/\{/, 'delimiter.bracket.open'],
            [/\}/, 'delimiter.bracket.close'],
            
            // 方括号
            [/\[/, 'delimiter.square.open'],
            [/\]/, 'delimiter.square.close'],
            
            // 数字
            [/\b\d+(\.\d+)?\b/, 'number'],
            
            // 条件操作符
            [/(%|==|!=|>=|<=|>|<)/, 'operator.condition'],
            
            // 范围操作符
            [/\.\./, 'operator.range'],
            
            // 逗号
            [/,/, 'delimiter.comma'],
            
            // 其他标识符
            [/\b[a-zA-Z_][\w]*\b/, 'identifier'],
            
            // 空白字符
            [/\s+/, 'white'],
          ]
        }
      });

      // 设置自动完成建议
      monaco.languages.registerCompletionItemProvider('pdfl', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          
          const suggestions = [
            // 命令建议
            {
              label: 'Load',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: '加载PDF文档',
              insertText: 'Load{url:"${1:https://example.com/document.pdf}"}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'Select',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: '选择页面',
              insertText: 'Select{mode:"${1:each}"}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'PNG',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: '转换为PNG格式',
              insertText: 'PNG{dpi:${1:300}}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'Save',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: '保存文件',
              insertText: 'Save{name:"${1:output}"}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'Concat',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: '合并PDF文档',
              insertText: 'Concat{}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            // 参数建议
            {
              label: 'url',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: 'PDF文档URL',
              insertText: 'url:"${1:https://example.com/document.pdf}"',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'mode',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: '选择模式: each | all',
              insertText: 'mode:"${1|each,all|}"',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'pages',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: '页面范围或条件',
              insertText: 'pages:${1}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'where',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: '筛选条件',
              insertText: 'where:${1}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'dpi',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: '图像分辨率',
              insertText: 'dpi:${1:300}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            {
              label: 'name',
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: '输出文件名',
              insertText: 'name:"${1:output}"',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: range,
            },
            // 特殊值建议
            {
              label: 'each',
              kind: monaco.languages.CompletionItemKind.Enum,
              documentation: '每页分别处理',
              insertText: 'each',
              range: range,
            },
            {
              label: 'all',
              kind: monaco.languages.CompletionItemKind.Enum,
              documentation: '所有页面一起处理',
              insertText: 'all',
              range: range,
            },
            // 管道符建议
            {
              label: '|',
              kind: monaco.languages.CompletionItemKind.Operator,
              documentation: '管道操作符',
              insertText: ' | ',
              range: range,
            },
          ];

          return { suggestions };
        }
      });

      // 定义自定义主题
      monaco.editor.defineTheme('pdfl-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword.command', foreground: '569cd6', fontStyle: 'bold' },
          { token: 'keyword.parameter', foreground: '9cdcfe' },
          { token: 'string.value', foreground: 'ce9178' },
          { token: 'keyword.special', foreground: 'c586c0' },
          { token: 'variable', foreground: '4fc1ff' },
          { token: 'operator.pipe', foreground: 'dcdcaa', fontStyle: 'bold' },
          { token: 'operator.assign', foreground: 'd4d4d4' },
          { token: 'delimiter.bracket.open', foreground: 'ffd700' },
          { token: 'delimiter.bracket.close', foreground: 'ffd700' },
          { token: 'delimiter.square.open', foreground: 'da70d6' },
          { token: 'delimiter.square.close', foreground: 'da70d6' },
          { token: 'number', foreground: 'b5cea8' },
          { token: 'operator.condition', foreground: 'd4d4d4' },
          { token: 'operator.range', foreground: 'd4d4d4' },
          { token: 'delimiter.comma', foreground: 'd4d4d4' },
        ],
        colors: {}
      });
    }
  };

  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
    
    // 设置默认内容
    editorInstance.setValue('Load{url:"https://example.com/document.pdf"} | Select{mode:"each"} | PNG{dpi:300} | Save{name:"pages"}');
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    setValue: (value: string) => {
      if (editorRef.current) {
        editorRef.current.setValue(value);
        editorRef.current.focus();
      }
    },
    insertTextAtCursor: (text: string) => {
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          editorRef.current.executeEdits('insert-text', [
            {
              range: new (window as any).monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: text,
              forceMoveMarkers: true,
            },
          ]);
          // 移动光标到插入文本的末尾
          const lines = text.split('\n');
          const newPosition = {
            lineNumber: position.lineNumber + lines.length - 1,
            column: lines.length === 1 ? position.column + text.length : lines[lines.length - 1].length + 1,
          };
          editorRef.current.setPosition(newPosition);
          editorRef.current.focus();
        }
      }
    },
  }));

  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.setValue('');
      editorRef.current.focus();
    }
  };

  const handleExecute = async () => {
    if (!editorRef.current) return;
    
    const command = editorRef.current.getValue().trim();
    if (!command) {
      alert('请输入有效的PDF-PL管道命令');
      return;
    }

    setIsLoading(true);
    try {
      await onExecute(command);
    } finally {
      setIsLoading(false);
    }
  };

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
        // 在编辑器光标位置插入Load语句
        const loadStatement = `Load{url:"${result.download_url}"}`;
        
        if (editorRef.current) {
          const position = editorRef.current.getPosition();
          if (position) {
            // 如果当前行不为空，在前面或后面添加空格
            const model = editorRef.current.getModel();
            if (model) {
              const lineContent = model.getLineContent(position.lineNumber);
              const beforeCursor = lineContent.substring(0, position.column - 1);
              const afterCursor = lineContent.substring(position.column - 1);
              
              let textToInsert = loadStatement;
              if (beforeCursor.trim() && !beforeCursor.endsWith(' ') && !beforeCursor.endsWith('\t')) {
                textToInsert = ' ' + textToInsert;
              }
              if (afterCursor.trim() && !afterCursor.startsWith(' ') && !afterCursor.startsWith('\t')) {
                textToInsert = textToInsert + ' ';
              }
              
              editorRef.current.executeEdits('insert-text', [
                {
                  range: new (window as any).monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                  ),
                  text: textToInsert,
                  forceMoveMarkers: true,
                },
              ]);
              
              // 移动光标到插入文本的末尾
              editorRef.current.setPosition({
                lineNumber: position.lineNumber,
                column: position.column + textToInsert.length,
              });
              editorRef.current.focus();
            }
          }
        }
        
        alert(`文件上传成功！文件ID: ${result.file_id}`);
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

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleExecute();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    lineNumbers: 'on',
    wordWrap: 'on',
    fontSize: 14,
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    folding: false,
    renderLineHighlight: 'all',
    selectOnLineNumbers: true,
    roundedSelection: false,
    readOnly: false,
    cursorStyle: 'line',
    cursorBlinking: 'blink',
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'top',
    quickSuggestions: true,
    contextmenu: true,
  };

  return (
    <div className={`bg-ms-dark-800 rounded-lg shadow-ms-dark overflow-hidden border border-ms-dark-700 ${className}`}>
      {/* Editor Header */}
      <div className="bg-ms-dark-850 border-b border-ms-dark-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-ms-blue rounded-full mr-3 shadow-ms-glow"></div>
            <h2 className="text-lg font-semibold text-white">管道编辑器</h2>
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
              disabled={isLoading || isUploading}
              className="px-4 py-2 h-11 text-sm font-medium text-ms-dark-300 bg-ms-dark-700 border border-ms-dark-600 rounded-md hover:bg-ms-dark-600 hover:border-ms-dark-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? '上传中...' : '上传文件'}
            </button>
            <button 
              onClick={handleClear}
              disabled={isLoading || isUploading}
              className="px-4 py-2 h-11 text-sm font-medium text-ms-dark-300 bg-ms-dark-700 border border-ms-dark-600 rounded-md hover:bg-ms-dark-600 hover:border-ms-dark-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              清空
            </button>
            <button 
              onClick={handleExecute}
              disabled={isLoading || isUploading}
              className="px-6 py-2 h-11 text-sm font-medium text-white bg-ms-blue border border-transparent rounded-md hover:bg-ms-blue-dark hover:shadow-ms-glow focus:outline-none focus:ring-2 focus:ring-ms-blue focus:ring-offset-2 focus:ring-offset-ms-dark-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '执行中...' : '执行管道'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Editor Container */}
      <div className="w-full h-64">
        <Editor
          defaultLanguage="pdfl"
          options={editorOptions}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme="pdfl-dark"
        />
      </div>
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;