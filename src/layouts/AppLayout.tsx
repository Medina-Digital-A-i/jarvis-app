import { Outlet, useLocation } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideNav from '@/components/SideNav';
import CommandBar from '@/components/CommandBar';
import { useSidebarCollapsed } from '@/lib/store';

export default function AppLayout() {
  const [collapsed] = useSidebarCollapsed();
  const { pathname } = useLocation();
  const onChat = pathname === '/chat';

  return (
    <div className="relative z-10 h-screen flex flex-col overflow-hidden">
      <TopBar />
      <div
        className="flex-1 grid min-h-0 transition-[grid-template-columns] duration-200"
        style={{
          gridTemplateColumns: collapsed ? '72px 1fr' : '248px 1fr',
        }}
      >
        <SideNav collapsed={collapsed} />
        <main className="min-h-0 overflow-y-auto p-6 lg:p-7">
          <Outlet />
        </main>
      </div>
      {/* Floating ask-anything bar everywhere except the dedicated chat page */}
      {!onChat && <CommandBar />}
    </div>
  );
}
