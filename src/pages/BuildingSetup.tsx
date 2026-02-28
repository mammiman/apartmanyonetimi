import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, KeyRound, LogOut } from "lucide-react";
import { getCurrentUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface BuildingSetupProps {
    onBuildingSelected: (buildingId: string) => void;
}

const BuildingSetup = ({ onBuildingSelected }: BuildingSetupProps) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [code, setCode] = useState("");

    // Check if user is already logged in and has a building
    useEffect(() => {
        const checkExistingUser = async () => {
            try {
                const user = await getCurrentUser();
                if (user?.profile?.building_id) {
                    console.log('BuildingSetup - User already has a building assigned:', user.profile.building_id);
                    onBuildingSelected(user.profile.building_id);
                }
            } catch (error) {
                console.error('BuildingSetup - Error checking user:', error);
            }
        };
        checkExistingUser();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!code.trim()) {
            toast.error("Bina kodu gereklidir");
            return;
        }

        setIsLoading(true);
        try {
            // Check if user is already logged in
            const user = await getCurrentUser();

            if (user && user.profile?.role === 'admin' && user.profile?.building_id) {
                // If user already has a building, don't let them join another via code
                // unless it's the same building
                const { data: bData } = await supabase
                    .from('buildings')
                    .select('id')
                    .eq('access_code', code.trim().toUpperCase())
                    .single();

                if (bData && bData.id === user.profile.building_id) {
                    onBuildingSelected(user.profile.building_id);
                    return;
                } else {
                    toast.error("Zaten bir apartmana bağlısınız. Başka bir apartmana bağlanamazsınız.");
                    return;
                }
            }

            // If user is logged in but has no building, use RPC to join officially in DB
            if (user) {
                const { data: newBuildingId, error: rpcError } = await supabase.rpc('join_building_by_code', {
                    p_code: code.trim().toUpperCase()
                });

                if (rpcError) {
                    toast.error("Bina koduna katılılamadı: " + rpcError.message);
                    return;
                }

                if (newBuildingId) {
                    toast.success("Apartmana başarıyla kaydedildiniz!");
                    onBuildingSelected(newBuildingId);
                    return;
                }
            }

            // Fallback/Guest check (legacy logic or for residents before login)
            const { data, error } = await supabase
                .from('buildings')
                .select('id, name')
                .eq('access_code', code.trim().toUpperCase())
                .single();

            if (error || !data) {
                toast.error("Geçersiz bina kodu");
                return;
            }

            toast.success(`"${data.name}" binasına bağlanıldı!`);
            onBuildingSelected(data.id);
        } catch (error: any) {
            toast.error(error.message || "Geçersiz bina kodu");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg mb-4">
                        <Building2 className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Apartman Yönetim</h1>
                    <p className="text-slate-600 mt-2">
                        Sisteme bağlanmak için bina kodunuzu girin
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5" />
                            Bina Kodu
                        </CardTitle>
                        <CardDescription>
                            Yöneticinizden aldığınız 6 haneli kodu girin.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="buildingCode">Kod</Label>
                                <Input
                                    id="buildingCode"
                                    type="text"
                                    placeholder="Örn: ABC123"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="text-center text-2xl tracking-[0.3em] font-mono uppercase"
                                    required
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading || code.length < 6}
                            >
                                {isLoading ? "Doğrulanıyor..." : "Giriş Yap"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <div className="mt-6 flex flex-col gap-4">
                    <p className="text-center text-xs text-muted-foreground">
                        Bina kodunuzu yöneticinizden talep edebilirsiniz.
                    </p>
                    <div className="flex justify-center">
                        <Button
                            variant="link"
                            className="text-primary font-semibold flex items-center gap-1"
                            onClick={() => navigate("/login")}
                        >
                            <LogOut className="w-4 h-4 rotate-180" />
                            Zaten Hesabım Var / Giriş Yap
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuildingSetup;
