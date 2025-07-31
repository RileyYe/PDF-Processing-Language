// API 请求和响应类型
export interface ExecuteCommandRequest {
  command: string;
}

export interface ExecuteCommandResponse {
  success: boolean;
  message: string;
  output_file?: string;
  download_url?: string;
  error?: string;
}

// 组件 Props 类型
export interface SyntaxHelpProps {
  className?: string;
}

export interface QuickStartProps {
  onExampleClick: (example: string) => void;
  className?: string;
}

export interface EditorProps {
  onExecute: (command: string) => Promise<void>;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  downloadUrl?: string;
  fileName?: string;
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

// 用法示例数据类型
export interface UsageExample {
  id: string;
  title: string;
  description: string;
  command: string;
  icon: React.ReactNode;
  color: string;
}