import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
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

const queryClient = new QueryClient();

const App = () => {
  const [buildingId, setBuildingId] = useState<string | null>(
    localStorage.getItem("selectedBuildingId")
  );

  const isResident = !!localStorage.getItem('residentSession');

  const handleBuildingSelected = (id: string) => {
    localStorage.setItem("selectedBuildingId", id);
    setBuildingId(id);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DataProvider>
          <HashRouter>
            {!buildingId && !isResident ? (
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
        </DataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
