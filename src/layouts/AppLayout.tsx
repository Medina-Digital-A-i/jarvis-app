import { Outlet, useLocation } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import SideNav from '@/components/SideNav';
import MobileNav from '@/components/MobileNav';
import CommandBar from '@/components/CommandBar';
import { useSidebarCollapsed } from '@/lib/store';

export default function AppLayout() {
  const [collapsed] = useSidebarCollapsed();
  const { pathname } = useLocation();
  const onChat = pathname === '/chat';

  return (
    <div className="relative z-10 h-screen flex flex-col overflow-hidden">
      <TopBar />
      {/* Sidebar is desktop-only (lg+); on mobile it's replaced by the bottom nav. */}
      <div className="flex-1 flex min-h-0">
        <SideNav collapsed={collapsed} />
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-7 pb-24 lg:pb-7">
          <Outlet />
        </main>
      </div>
      {/* Floating ask-anything bar everywhere except the dedicated chat page */}
      {!onChat && <CommandBar />}
      {/* Bottom tab bar — mobile only */}
      <MobileNav />
    </div>
  );
}
