import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function MainLayout({ onLogout }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#06040A]">
      {/* Dynamic Sidebar handles its own multi-user authentication profile states */}
      <Sidebar onLogout={onLogout} />
      
      {/* Primary Workspace Stage Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}