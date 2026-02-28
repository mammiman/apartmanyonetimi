import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  BookOpen,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { signOut } from "@/lib/supabase";
import { toast } from "sonner";

const navItems = [
  { title: "Anasayfa", url: "/", icon: LayoutDashboard },
  { title: "Daireler", url: "/daireler", icon: Building2 },
  { title: "Aidat Çizelgesi", url: "/aidat", icon: Receipt },
  { title: "İşletme Defteri", url: "/isletme-defteri", icon: BookOpen },
  { title: "Personel", url: "/personel", icon: Users },
];

import { useData } from "@/context/DataContext";

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { apartmentName } = useData();

  // Close mobile sidebar on route change
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Çıkış yapıldı");
      navigate("/login");
    } catch (error) {
      toast.error("Çıkış yapılırken hata oluştu");
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300
          ${collapsed ? "w-16" : "w-64"}
          /* Desktop: normal sticky flow */
          sticky top-0 h-screen
          /* Mobile: fixed overlay */
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:h-full
          ${mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Building className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-slide-in overflow-hidden flex-1 min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground leading-tight truncate">
                {apartmentName}
              </h1>
              <p className="text-xs text-sidebar-muted truncate">Apartman Yönetimi</p>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden ml-auto p-1 rounded text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                activeClassName=""
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="truncate animate-slide-in">{item.title}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer - Logout and Collapse — sticky at bottom */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-1 shrink-0">
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/10 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">Çıkış Yap</span>}
          </button>

          {/* Collapse Toggle — hidden on mobile */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center rounded-lg px-3 py-2 text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Daralt</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
