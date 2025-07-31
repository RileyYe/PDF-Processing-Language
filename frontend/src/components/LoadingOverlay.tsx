import React from 'react';
import { LoadingOverlayProps } from '@/types';

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  message = '正在执行管道...' 
}) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ms-dark-950 bg-opacity-90 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ms-blue mx-auto mb-4"></div>
        <p className="text-white font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;