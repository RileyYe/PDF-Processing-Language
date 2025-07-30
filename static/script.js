// 全局变量
let editor;
const API_BASE_URL = ''; // 使用相对路径，因为前后端在同一服务器

// DOM元素
const elements = {
    executeBtn: null,
    clearBtn: null,
    closeModal: null,
    resultModal: null,
    loadingOverlay: null,
    resultMessage: null
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeMonacoEditor();
    setupEventListeners();
});

// 初始化DOM元素引用
function initializeElements() {
    elements.executeBtn = document.getElementById('executeBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.closeModal = document.getElementById('closeModal');
    elements.resultModal = document.getElementById('resultModal');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.resultMessage = document.getElementById('resultMessage');
}

// 初始化Monaco编辑器
function initializeMonacoEditor() {
    require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@latest/min/vs' } });
    
    require(['vs/editor/editor.main'], function() {
        // 定义PDF-PL语法高亮
        monaco.languages.register({ id: 'pdfl' });
        
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
                    [/\b(each|true|false)\b/, 'keyword.special'],
                    
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
        
        // 设置PDF-PL主题
        monaco.editor.defineTheme('pdfl-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword.command', foreground: '569cd6', fontStyle: 'bold' },
                { token: 'keyword.parameter', foreground: '9cdcfe', fontStyle: 'bold' },
                { token: 'keyword.special', foreground: 'c586c0', fontStyle: 'bold' },
                { token: 'string.value', foreground: 'ce9178' },
                { token: 'variable', foreground: '4fc1ff', fontStyle: 'bold' },
                { token: 'operator.pipe', foreground: 'ff6b6b', fontStyle: 'bold' },
                { token: 'operator.assign', foreground: 'd4d4d4' },
                { token: 'operator.condition', foreground: 'f78c6c' },
                { token: 'operator.range', foreground: 'd4d4d4' },
                { token: 'delimiter.bracket.open', foreground: 'ffd700' },
                { token: 'delimiter.bracket.close', foreground: 'ffd700' },
                { token: 'delimiter.square.open', foreground: 'da70d6' },
                { token: 'delimiter.square.close', foreground: 'da70d6' },
                { token: 'delimiter.comma', foreground: 'd4d4d4' },
                { token: 'number', foreground: 'b5cea8' },
                { token: 'identifier', foreground: 'dcdcaa' }
            ],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#d4d4d4',
                'editor.lineHighlightBackground': '#2d2d30',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3d41'
            }
        });
        
        // 创建编辑器实例
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: '',
            language: 'pdfl',
            theme: 'pdfl-dark',
            fontSize: 16,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            contextmenu: true,
            folding: true
        });
        
        // 添加快捷键
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, executeCommand);
        
        // 自动补全
        monaco.languages.registerCompletionItemProvider('pdfl', {
            provideCompletionItems: function(model, position) {
                const suggestions = [
                    // 命令建议
                    {
                        label: 'Load',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'Load{url:"${1:https://example.com/file.pdf}"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '生成器命令：加载PDF文件'
                    },
                    {
                        label: 'Select',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'Select{${1|mode:"each",pages:"1,3,5",where:"\\$page % 2 == 1"|}}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '转换器命令：选择页面（分流器）'
                    },
                    {
                        label: 'Concat',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'Concat',
                        documentation: '转换器命令：合并文档（聚合器）'
                    },
                    {
                        label: 'PNG',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'PNG{dpi:${1:300}}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '转换器命令：转换为PNG图像'
                    },
                    {
                        label: 'PNG (单图)',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'PNG{dpi:${1:300},mode:"single"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '强制转换为单一合并PNG图像'
                    },
                    {
                        label: 'PNG (分页)',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'PNG{dpi:${1:300},mode:"pages"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '强制转换为多个PNG图像（每页一个）'
                    },
                    {
                        label: 'Save',
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: 'Save{name:"${1:output}"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '消费者命令：保存结果为ZIP文件'
                    },
                    
                    // 参数建议
                    {
                        label: 'url',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'url:"${1:https://example.com/file.pdf}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'PDF文件的URL地址'
                    },
                    {
                        label: 'mode',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'mode:"${1:each}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '选择模式：each（每一页）'
                    },
                    {
                        label: 'pages',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'pages:"${1:1,3,5}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '静态页面选择：支持单页、范围、$total变量'
                    },
                    {
                        label: 'where',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'where:"${1:\\$page % 2 == 1}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '条件表达式：使用$page和$total变量'
                    },
                    {
                        label: 'dpi',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'dpi:${1:300}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '图像分辨率（Dots Per Inch）'
                    },
                    {
                        label: 'mode (PNG)',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'mode:"${1|auto,single,pages|}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'PNG转换模式：auto(自动)、single(合并图像)、pages(分页图像)'
                    },
                    {
                        label: 'name',
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: 'name:"${1:output}"',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '输出文件名（不含扩展名）'
                    },
                    
                    // 模板建议
                    {
                        label: '用例1: 分页转PNG',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'Load{url:"${1:https://example.com/file.pdf}"} | Select{mode:"each"} | PNG{dpi:${2:300}} | Save{name:"${3:pages}"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '将PDF每一页分别保存为PNG图片'
                    },
                    {
                        label: '用例2: 奇数页合并',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'Load{url:"${1:https://example.com/file.pdf}"} | Select{where:"\\$page % 2 == 1"} | Concat | Save{name:"${2:odd_pages}"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '提取奇数页并合并为一个新的PDF'
                    },
                    {
                        label: '用例3: 封面封底',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'Load{url:"${1:https://example.com/file.pdf}"} | Select{pages:"1,\\$total"} | Save{name:"${2:cover_back}"}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '仅提取封面和封底'
                    }
                ];
                
                return { suggestions: suggestions };
            }
        });
    });
}

// 设置事件监听器
function setupEventListeners() {
    elements.executeBtn.addEventListener('click', executeCommand);
    elements.clearBtn.addEventListener('click', clearEditor);
    elements.closeModal.addEventListener('click', closeModal);
    
    // 模态框点击外部关闭
    elements.resultModal.addEventListener('click', function(e) {
        if (e.target === elements.resultModal) {
            closeModal();
        }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    // 用法示例卡片点击事件
    setupUsageCardListeners();
}

// 设置用法示例卡片事件监听器
function setupUsageCardListeners() {
    const usageCards = document.querySelectorAll('.usage-card');
    usageCards.forEach(card => {
        card.addEventListener('click', function() {
            const example = this.dataset.example;
            if (example && editor) {
                const currentValue = editor.getValue();
                const newValue = currentValue ? `${currentValue}\n${example}\n` : `${example}\n`;
                editor.setValue(newValue);
                editor.focus();
                
                // 将光标移动到最后
                const model = editor.getModel();
                const lastLine = model.getLineCount();
                const lastColumn = model.getLineMaxColumn(lastLine);
                editor.setPosition({ lineNumber: lastLine, column: lastColumn });
                
                // 添加视觉反馈
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            }
        });
    });
}

// 执行命令
async function executeCommand() {
    if (!editor) return;
    
    const command = editor.getValue().trim();
    if (!command) {
        showError('请输入有效的PDF-PL管道命令');
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    elements.executeBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ command: command })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        
        // 处理文件下载
        const blob = await response.blob();
        const filename = response.headers.get('Content-Disposition')?.match(/filename=(.+)/)?.[1] || 'pdflang_output.zip';
        const filesCount = response.headers.get('X-Files-Count') || '未知';
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // 显示成功信息
        showSuccess(`执行成功！已生成 ${filesCount} 个文件，正在下载...`);
        
    } catch (error) {
        console.error('管道执行失败:', error);
        showError(`管道执行失败: ${error.message}`);
    } finally {
        showLoading(false);
        elements.executeBtn.disabled = false;
    }
}

// 清空编辑器
function clearEditor() {
    if (editor) {
        editor.setValue('');
        editor.focus();
    }
}

// 显示加载状态
function showLoading(show) {
    if (show) {
        elements.loadingOverlay.classList.remove('hidden');
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
}

// 显示成功信息
function showSuccess(message) {
    elements.resultMessage.innerHTML = `
        <div class="text-green-400 mb-4 font-semibold">
            <strong>✅ 执行成功</strong>
        </div>
        <div class="text-ms-dark-200">${message}</div>
    `;
    elements.resultModal.classList.remove('hidden');
}

// 显示错误信息
function showError(message) {
    elements.resultMessage.innerHTML = `
        <div class="text-red-400 mb-4 font-semibold">
            <strong>❌ 执行失败</strong>
        </div>
        <div class="text-ms-dark-200">${message}</div>
    `;
    elements.resultModal.classList.remove('hidden');
}

// 关闭模态框
function closeModal() {
    elements.resultModal.classList.add('hidden');
}



// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 工具函数：格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 