import { ReactNode, useState, useEffect } from 'react';
import { AppSidebar } from "@/components/AppSidebar";
import { getCurrentUser } from "@/lib/supabase";
import { Menu, AlertCircle, RefreshCw } from "lucide-react";
import { useData } from "@/context/DataContext";
import { Button } from "./ui/button";

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

  const { isDbAvailable, retryRemoteData } = useData();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await retryRemoteData();
    // No need to reset isRetrying as window.reload() will happen
  };

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

        {!isDbAvailable && (
          <div className="bg-amber-100 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-3 flex items-center justify-between sticky top-0 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 text-amber-900 dark:text-amber-200 text-sm font-medium">
              <AlertCircle className="h-5 w-5 text-amber-600 animate-pulse" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-bold">Bağlantı Sorunu:</span>
                <span>Sunucuya erişilemiyor. Offline moddasınız (Sadece lokal veriler).</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2 bg-white/50 border-amber-300 hover:bg-white text-amber-900 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Bağlanılıyor...' : 'Tekrar Dene'}
            </Button>
          </div>
        )}

        <div className={`p-4 md:p-6 lg:p-8 ${shouldHideSidebar ? 'max-w-full' : 'max-w-[1400px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
