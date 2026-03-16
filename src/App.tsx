import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Apartments from "./pages/Apartments";
import DuesSchedule from "./pages/DuesSchedule";
import OperatingLedger from "./pages/OperatingLedger";
import Staff from "./pages/Staff";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResidentDashboard from "./pages/ResidentDashboard";
import BuildingSetup from "./pages/BuildingSetup";
import NotFound from "./pages/NotFound";
import { DataProvider } from "@/context/DataContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DataLoadingWrapper } from "@/components/DataLoadingWrapper";
import { supabase } from "@/lib/supabase";
import { getActiveBuildingId, onActiveBuildingChange, setActiveBuildingId } from "@/lib/buildingSelection";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const App = () => {
  const [buildingId, setBuildingId] = useState<string | null>(
    getActiveBuildingId()
  );

  const isResident = !!localStorage.getItem('residentSession');

  // Auth durumunu kontrol et: Supabase session varsa BuildingSetup'ı atla,
  // ProtectedRoute building_id'yi DB'den alıp localStorage'a set eder.
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();

    const unsubscribe = onActiveBuildingChange((id) => {
      setBuildingId(id);
    });

    return () => unsubscribe();
  }, []);

  const handleBuildingSelected = (id: string) => {
    setActiveBuildingId(id);
  };

  // Auth kontrolü bitmeden ekran gösterme
  if (!authChecked && !isResident) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // BuildingSetup göster:
  // - Giriş yapmamış + resident değil (kod girmesi gerekiyor)
  // - VEYA: Giriş yapmış (admin) ama henüz bina seçilmemiş (çoklu bina senaryosu)
  const showBuildingSetup = !isResident && (
    (!buildingId && !isAuthenticated) ||  // Giriş yapmamış
    (!buildingId && isAuthenticated)      // Giriş yapmış ama bina seçilmemiş
  );


  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DataProvider>
            <DataLoadingWrapper>
              <HashRouter>
                {showBuildingSetup ? (
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="*" element={<BuildingSetup onBuildingSelected={handleBuildingSelected} />} />
                  </Routes>
                ) : (
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/resident" element={<ProtectedRoute><ResidentDashboard /></ProtectedRoute>} />
                    <Route path="/daireler" element={<ProtectedRoute requireAdmin><Apartments /></ProtectedRoute>} />
                    <Route path="/aidat" element={<ProtectedRoute requireAdmin><DuesSchedule /></ProtectedRoute>} />
                    <Route path="/isletme-defteri" element={<ProtectedRoute requireAdmin><OperatingLedger /></ProtectedRoute>} />
                    <Route path="/personel" element={<ProtectedRoute requireAdmin><Staff /></ProtectedRoute>} />
                    <Route path="/kullanici-yonetimi" element={<ProtectedRoute requireAdmin><Register /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                )}
              </HashRouter>
            </DataLoadingWrapper>
          </DataProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

