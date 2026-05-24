import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideNav from '@/components/SideNav';
import CommandBar from '@/components/CommandBar';

export default function AppLayout() {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 grid lg:grid-cols-[240px_1fr] grid-cols-1 min-h-0">
        <SideNav />
        <main className="p-7 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandBar />
    </div>
  );
}
