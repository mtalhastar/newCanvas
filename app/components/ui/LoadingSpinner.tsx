import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-200"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-black border-t-transparent"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner; 