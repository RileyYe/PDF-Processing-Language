import axios from 'axios';
import { ExecuteCommandRequest, ExecuteCommandResponse } from '@/types';

interface UploadResponse {
  success: boolean;
  message: string;
  file_id?: string;
  download_url?: string;
  error?: string;
}

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

// API 函数
export const executeCommand = async (command: string): Promise<ExecuteCommandResponse> => {
  try {
    const response = await api.post<ExecuteCommandResponse>('/execute', {
      command,
    } as ExecuteCommandRequest);
    return response.data;
  } catch (error) {
    console.error('Execute command error:', error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || error.message || '网络请求失败');
    }
    throw new Error('未知错误');
  }
};

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post<UploadResponse>('http://localhost:9000/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
    
    return response.data;
  } catch (error) {
    console.error('Upload file error:', error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || error.message || '文件上传失败');
    }
    throw new Error('文件上传失败');
  }
};

export default api;