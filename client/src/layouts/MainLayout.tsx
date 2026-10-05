import React from 'react';
import { Outlet } from 'react-router-dom';

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#080F1A] text-white flex flex-col font-sans">
      <Outlet />
    </div>
  );
};
export default MainLayout;
