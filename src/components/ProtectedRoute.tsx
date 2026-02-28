import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser, supabase } from "@/lib/supabase";

interface ProtectedRouteProps {
    children: ReactNode;
    requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const location = useLocation();

    useEffect(() => {
        console.log('useEffect - Component mounted, checking user');
        checkUser();

        // Only listen for Supabase auth changes if not a resident
        const residentSession = localStorage.getItem('residentSession');
        if (!residentSession) {
            console.log('useEffect - No resident session, setting up Supabase listener');
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                console.log('useEffect - Supabase auth state changed:', _event, session);
                if (session) {
                    checkUser();
                } else {
                    setUser(null);
                    setIsLoading(false);
                }
            });

            return () => {
                console.log('useEffect - Cleaning up Supabase listener');
                subscription.unsubscribe();
            };
        } else {
            console.log('useEffect - Resident session exists, skipping Supabase listener');
        }
    }, []);

    const checkUser = async () => {
        console.log('checkUser - Starting...');
        try {
            // Check for resident session first (synchronously)
            const residentSession = localStorage.getItem('residentSession');
            console.log('checkUser - residentSession:', residentSession);

            if (residentSession) {
                const session = JSON.parse(residentSession);
                console.log('checkUser - parsed session:', session);

                const userObj = {
                    id: `resident_${session.accessCode}`,
                    profile: {
                        role: 'resident',
                        apartment_id: session.apartmentId
                    }
                };

                console.log('checkUser - Setting user to:', userObj);
                setUser(userObj);
                setIsLoading(false);
                console.log('checkUser - User set, returning');
                return;
            }

            console.log('checkUser - No resident session, checking Supabase...');
            // Otherwise check Supabase auth (for admin users)
            const currentUser = await getCurrentUser();
            console.log('checkUser - Supabase user:', currentUser);

            if (currentUser) {
                setUser(currentUser);
                setIsLoading(false);
                return;
            }

            // No user found
            console.log('checkUser - No user found');
            setUser(null);
        } catch (error) {
            console.error('checkUser - Error:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
            console.log('checkUser - Finally block, isLoading set to false');
        }
    };

    if (isLoading) {
        console.log('ProtectedRoute - Loading...');
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    console.log('ProtectedRoute - user:', user);
    console.log('ProtectedRoute - location.pathname:', location.pathname);
    console.log('ProtectedRoute - requireAdmin:', requireAdmin);

    if (!user) {
        console.log('ProtectedRoute - No user, redirecting to login');
        return <Navigate to="/login" replace />;
    }

    // If user is admin (or pending), strictly enforce building isolation
    if (user && (user.profile?.role === 'admin' || user.profile?.role === 'pending')) {
        const dbBuildingId = user.profile?.building_id;
        const localBuildingId = localStorage.getItem("selectedBuildingId");
        const isPending = user.profile?.role === 'pending';

        console.log(`[AUTH-CHECK] DB=${dbBuildingId}, Local=${localBuildingId}, Role=${user.profile?.role}`);

        // Handle case where user has no building yet or is pending
        if (!dbBuildingId || isPending) {
            console.log('[AUTH-BLOCK] User is pending or has no building assigned');
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-center">
                    <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Onay Bekleniyor</h2>
                        <p className="text-slate-600 mb-6">
                            Hesabınız henüz bir apartmana atanmamış veya onayı bekliyor. Lütfen sistem yöneticinizin sizi doğru apartmana atamasını bekleyin.
                        </p>
                        <button
                            onClick={() => {
                                localStorage.removeItem('selectedBuildingId');
                                supabase.auth.signOut();
                                window.location.href = "/login";
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            );
        }

        // CRITICAL ISOLATION: If user is trying to access a building they are NOT authorized for
        if (dbBuildingId !== localBuildingId) {
            console.log(`[AUTH-ISOLATION-BREACH] Attempted ${localBuildingId}, but user belongs to ${dbBuildingId}`);

            // Force the correct building ID
            localStorage.setItem("selectedBuildingId", dbBuildingId);

            // Critical reload
            window.location.reload();
            return null;
        }
    }

    // If user is a resident
    if (user.profile?.role === 'resident') {
        console.log('ProtectedRoute - User is resident');
        // Redirect residents to their dashboard if they try to access admin pages
        if (requireAdmin || location.pathname === '/') {
            console.log('ProtectedRoute - Redirecting resident to /resident');
            return <Navigate to="/resident" replace />;
        }
    }

    // If user is admin trying to access /resident, redirect to home
    if (user.profile?.role === 'admin' && location.pathname === '/resident') {
        console.log('ProtectedRoute - Admin trying to access /resident, redirecting to /');
        return <Navigate to="/" replace />;
    }

    // If admin is required but user is not admin
    if (requireAdmin && user.profile?.role !== 'admin') {
        console.log('ProtectedRoute - Admin required but user is not admin, redirecting to /');
        return <Navigate to="/" replace />;
    }

    console.log('ProtectedRoute - Rendering children');
    return <>{children}</>;
};
