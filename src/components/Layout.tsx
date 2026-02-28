import { ReactNode, useState } from 'react';
import { AppSidebar } from "@/components/AppSidebar";
import { getCurrentUser } from "@/lib/supabase";
import { useEffect } from "react";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  const [isResident, setIsResident] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      const residentSession = localStorage.getItem('residentSession');
      if (residentSession) {
        setIsResident(true);
      } else {
        const user = await getCurrentUser();
        setIsResident(user?.profile?.role === 'resident');
      }
    };
    checkUserRole();
  }, []);

  const shouldHideSidebar = hideSidebar || isResident;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {!shouldHideSidebar && (
        <AppSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      <main className={`flex-1 overflow-auto min-w-0 ${shouldHideSidebar ? 'w-full' : ''}`}>
        {/* Mobile topbar */}
        {!shouldHideSidebar && (
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-30">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-foreground truncate">Apartman Yönetimi</span>
          </div>
        )}

        <div className={`p-4 md:p-6 lg:p-8 ${shouldHideSidebar ? 'max-w-full' : 'max-w-[1400px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
