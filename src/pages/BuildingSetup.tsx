import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, KeyRound, LogOut, PlusCircle, ChevronRight, Check } from "lucide-react";
import { getCurrentUser, supabase } from "@/lib/supabase";
import * as api from "@/lib/api";
import { toast } from "sonner";
import { setActiveBuildingId } from "@/lib/buildingSelection";

interface BuildingInfo {
    id: string;
    name: string;
    access_code: string;
    role: string;
}

interface BuildingSetupProps {
    onBuildingSelected: (buildingId: string) => void;
}

const BuildingSetup = ({ onBuildingSelected }: BuildingSetupProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [code, setCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
    const [userEmail, setUserEmail] = useState("");

    // Kullanıcının binalarını yükle
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const user = await getCurrentUser();
                if (!user) {
                    // Oturum yoksa login'e yönlendir
                    window.location.hash = '#/login';
                    return;
                }
                setUserEmail(user.email || '');

                // Kullanıcının binalarını çek
                const userBuildings = await api.fetchUserBuildings();

                if (userBuildings.length === 1) {
                    // Sadece 1 bina varsa direkt seç
                    onBuildingSelected(userBuildings[0].id);
                    return;
                }

                if (userBuildings.length > 1) {
                    setBuildings(userBuildings);
                } else {
                    // Hiç bina yoksa — eski user.profile.building_id dene
                    if (user.profile?.building_id) {
                        onBuildingSelected(user.profile.building_id);
                        return;
                    }
                    // Yeni bina eklemesi için form göster
                    setShowJoinForm(true);
                }
            } catch (e) {
                console.error('BuildingSetup load error:', e);
                setShowJoinForm(true);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleSelectBuilding = (buildingId: string) => {
        setActiveBuildingId(buildingId);
        onBuildingSelected(buildingId);
    };

    const handleJoinBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || code.length < 6) return;
        setIsJoining(true);
        try {
            // RPC ile mevcut users.building_id yolu (eski uyumluluk)
            const { data: newBuildingId, error: rpcError } = await supabase.rpc('join_building_by_code', {
                p_code: code.trim().toUpperCase()
            });

            // user_buildings tablosuna da ekle (yeni çoklu bina desteği)
            const building = await api.addUserToBuilding(code.trim());

            if (building) {
                toast.success(`"${building.name}" binasına eklendi!`);
                // Listeye ekle
                const updated = await api.fetchUserBuildings();
                setBuildings(updated);
                setShowJoinForm(false);
                setCode("");
                if (updated.length === 1) {
                    handleSelectBuilding(updated[0].id);
                }
            } else if (newBuildingId && !rpcError) {
                toast.success("Apartmana başarıyla kaydedildiniz!");
                onBuildingSelected(newBuildingId);
            } else {
                toast.error("Bina kodu doğrulandı fakat hesabınıza yetki atanamadı. Lütfen yöneticiye danışın.");
            }
        } catch (error: any) {
            toast.error(error.message || "Geçersiz bina kodu");
        } finally {
            setIsJoining(false);
        }
    };

    const handleLogout = async () => {
        setActiveBuildingId(null);
        await supabase.auth.signOut();
        window.location.hash = '#/login';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    <p className="text-sm text-slate-500">Binalar yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg mb-4 ring-4 ring-primary/10">
                        <Building2 className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Apartman Yönetim</h1>
                    {userEmail && (
                        <p className="text-sm text-slate-500 mt-1">
                            <span className="font-medium text-slate-700">{userEmail}</span> olarak giriş yapıldı
                        </p>
                    )}
                </div>

                {/* Bina Listesi */}
                {buildings.length > 0 && (
                    <Card className="mb-4 shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" />
                                Binalarınız
                            </CardTitle>
                            <CardDescription>Yönetmek istediğiniz binayı seçin</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 pb-4">
                            {buildings.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => handleSelectBuilding(b.id)}
                                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-100 hover:border-primary/50 hover:bg-primary/5 transition-all group text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Building2 className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{b.name}</p>
                                            <p className="text-xs text-slate-400 font-mono">Kod: {b.access_code}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                                </button>
                            ))}
                        </CardContent>
                        <div className="px-6 pb-4">
                            <button
                                onClick={() => setShowJoinForm(!showJoinForm)}
                                className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                            >
                                <PlusCircle className="w-4 h-4" />
                                {showJoinForm ? 'Formu Kapat' : 'Yeni Bina Ekle'}
                            </button>
                        </div>
                    </Card>
                )}

                {/* Bina Ekleme Formu */}
                {(showJoinForm || buildings.length === 0) && (
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="w-5 h-5" />
                                {buildings.length === 0 ? 'Binaya Bağlan' : 'Yeni Bina Ekle'}
                            </CardTitle>
                            <CardDescription>
                                {buildings.length === 0
                                    ? 'Sisteme bağlanmak için bina kodunuzu girin'
                                    : 'Bina kodunu girerek başka bir binayı da yönetebilirsiniz'}
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleJoinBuilding}>
                            <CardContent>
                                <div className="space-y-2">
                                    <Label htmlFor="buildingCode">Bina Kodu</Label>
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
                                    <p className="text-xs text-muted-foreground text-center">
                                        Bina kodunuzu yöneticinizden talep edebilirsiniz
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                {buildings.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setShowJoinForm(false)}
                                    >
                                        İptal
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    className="flex-1 gap-2"
                                    disabled={isJoining || code.length < 6}
                                >
                                    {isJoining ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                            Doğrulanıyor...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            {buildings.length === 0 ? 'Bağlan' : 'Ekle'}
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                )}

                {/* Çıkış */}
                <div className="mt-4 flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-600 gap-2"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4" />
                        Çıkış Yap
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BuildingSetup;
