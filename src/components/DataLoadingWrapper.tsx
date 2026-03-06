import React from "react";
import { useData } from "@/context/DataContext";

const LoadingScreen: React.FC = () => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#e0e0e0',
        fontFamily: 'Inter, system-ui, sans-serif',
    }}>
        <div style={{
            width: 48,
            height: 48,
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 24,
        }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Veriler yükleniyor...
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: 8 }}>
            Lütfen bekleyin, veritabanından veriler çekiliyor.
        </p>
        <style>{`
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `}</style>
    </div>
);

export const DataLoadingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoading } = useData();

    if (isLoading) {
        return <LoadingScreen />;
    }

    return <>{children}</>;
};

export default DataLoadingWrapper;
