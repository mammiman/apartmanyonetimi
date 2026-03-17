import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, UserPlus } from "lucide-react";
import { signIn, signUp, signInWithAccessCode, sendPasswordResetEmail, supabase, updateCurrentUserPassword } from "@/lib/supabase";
import { setActiveBuildingId } from "@/lib/buildingSelection";
import * as api from "@/lib/api";
import { toast } from "sonner";

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

    // Admin login state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [adminBuildingCode, setAdminBuildingCode] = useState("");

    // Admin register state
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regPasswordConfirm, setRegPasswordConfirm] = useState("");

    // Resident login state
    const [accessCode, setAccessCode] = useState("");
    const [buildingCode, setBuildingCode] = useState("");

    useEffect(() => {
        if (window.location.href.includes("type=recovery")) {
            setIsRecoveryMode(true);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecoveryMode(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const selectedAdminBuildingCode = adminBuildingCode.trim().toUpperCase();
            localStorage.removeItem('residentSession');
            await signIn(email, password);

            if (selectedAdminBuildingCode) {
                const userBuildings = await api.fetchUserBuildings();
                const matchedBuilding = userBuildings.find(
                    (b) => b.access_code?.toUpperCase() === selectedAdminBuildingCode
                );

                if (!matchedBuilding) {
                    await supabase.auth.signOut();
                    throw new Error("Bu apartman kodu hesabınıza tanımlı değil");
                }

                setActiveBuildingId(matchedBuilding.id);
            }

            toast.success("Giriş başarılı!");
            
            // GitHub Pages HashRouter uyumluluğu için
            window.location.hash = "#/";
            setTimeout(() => {
                window.location.reload();
            }, 50);
        } catch (error: any) {
            toast.error(error.message || "Giriş başarısız");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetAdminBuildingSelection = () => {
        setActiveBuildingId(null);
        setAdminBuildingCode("");
        toast.success("Yönetici apartman seçimi sıfırlandı.");
    };

    const handleAdminRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (regPassword !== regPasswordConfirm) {
            toast.error("Şifreler eşleşmiyor");
            return;
        }
        if (regPassword.length < 6) {
            toast.error("Şifre en az 6 karakter olmalıdır");
            return;
        }

        setIsLoading(true);
        try {
            await signUp(regEmail, regPassword);
            toast.success("Kayıt başarılı! Hesabınız onaylandıktan ve apartman ataması yapıldıktan sonra giriş yapabilirsiniz.");

            setRegEmail("");
            setRegPassword("");
            setRegPasswordConfirm("");
        } catch (error: any) {
            toast.error(error.message || "Kayıt başarısız");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResidentLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const selectedBuildingCode = buildingCode.trim().toUpperCase();
            await signInWithAccessCode(accessCode, selectedBuildingCode || undefined);
            toast.success("Giriş başarılı!");

            // GitHub Pages'te HashRouter base hatası olmaması için direkt hash atıp yeniliyoruz
            window.location.hash = '#/resident';
            setTimeout(() => {
                window.location.reload();
            }, 50);
        } catch (error: any) {
            toast.error(error?.message || "Geçersiz erişim kodu");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetBuildingSelection = () => {
        setActiveBuildingId(null);
        setBuildingCode("");
        localStorage.removeItem('residentSession');
        toast.success("Apartman seçimi sıfırlandı. Yeni apartman kodu girebilirsiniz.");
    };

    const handleForgotPassword = async () => {
        const targetEmail = (forgotEmail || email).trim();
        if (!targetEmail) {
            toast.error("Önce e-posta adresinizi girin");
            return;
        }

        setIsLoading(true);
        try {
            await sendPasswordResetEmail(targetEmail);
            toast.success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        } catch (error: any) {
            toast.error(error.message || "Şifre sıfırlama e-postası gönderilemedi");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecoveryPasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== newPasswordConfirm) {
            toast.error("Yeni şifreler eşleşmiyor");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Yeni şifre en az 6 karakter olmalıdır");
            return;
        }

        setIsLoading(true);
        try {
            await updateCurrentUserPassword(newPassword);
            toast.success("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
            setIsRecoveryMode(false);
            setNewPassword("");
            setNewPasswordConfirm("");
            await supabase.auth.signOut();
            window.location.hash = "#/login";
        } catch (error: any) {
            toast.error(error.message || "Şifre güncellenemedi");
        } finally {
            setIsLoading(false);
        }
    };

    if (isRecoveryMode) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <div className="w-full max-w-md">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yeni Şifre Belirle</CardTitle>
                            <CardDescription>Hesabınız için yeni şifrenizi girin</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleRecoveryPasswordUpdate}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">Yeni Şifre</Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="En az 6 karakter"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newPasswordConfirm">Yeni Şifre Tekrar</Label>
                                    <Input
                                        id="newPasswordConfirm"
                                        type="password"
                                        value={newPasswordConfirm}
                                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                        required
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg mb-4 overflow-hidden">
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/b/b4/Flag_of_Turkey.svg"
                            alt="Türk Bayrağı"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Apartman Yönetim</h1>
                    <p className="text-slate-600 mt-2">Yönetim Sistemi</p>
                </div>

                <Tabs defaultValue="admin" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="admin">Giriş</TabsTrigger>
                        <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
                        <TabsTrigger value="resident">Sakin</TabsTrigger>
                    </TabsList>

                    <TabsContent value="admin">
                        <Card>
                            <CardHeader>
                                <CardTitle>Yönetici Girişi</CardTitle>
                                <CardDescription>E-posta ve şifrenizle giriş yapın</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleAdminLogin}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-posta</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="ornek@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Şifre</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="adminBuildingCode">Apartman Kodu (Opsiyonel)</Label>
                                        <Input
                                            id="adminBuildingCode"
                                            type="text"
                                            placeholder="ABC123"
                                            maxLength={6}
                                            value={adminBuildingCode}
                                            onChange={(e) => setAdminBuildingCode(e.target.value.toUpperCase())}
                                            className="text-center tracking-[0.25em] font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Farklı bir apartmana geçmek için girişte bu kodu değiştirebilirsiniz
                                        </p>
                                    </div>
                                    <div className="space-y-2 pt-1">
                                        <Label htmlFor="forgotEmail">Şifre Sıfırlama E-postası</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="forgotEmail"
                                                type="email"
                                                placeholder="ornek@email.com"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                            />
                                            <Button type="button" variant="outline" onClick={handleForgotPassword} disabled={isLoading}>
                                                Şifremi Unuttum
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isLoading || (adminBuildingCode.length > 0 && adminBuildingCode.length !== 6)}
                                    >
                                        {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
                                    </Button>
                                    <Button type="button" variant="outline" className="w-full" onClick={handleResetAdminBuildingSelection}>
                                        Apartman Seçimini Sıfırla
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>

                    <TabsContent value="register">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" />
                                    Yönetici Hesabı Oluştur
                                </CardTitle>
                                <CardDescription>
                                    Bu bina için yeni bir yönetici hesabı oluşturun
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleAdminRegister}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="regEmail">E-posta</Label>
                                        <Input
                                            id="regEmail"
                                            type="email"
                                            placeholder="ornek@email.com"
                                            value={regEmail}
                                            onChange={(e) => setRegEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="regPassword">Şifre</Label>
                                        <Input
                                            id="regPassword"
                                            type="password"
                                            placeholder="En az 6 karakter"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="regPasswordConfirm">Şifre Tekrar</Label>
                                        <Input
                                            id="regPasswordConfirm"
                                            type="password"
                                            value={regPasswordConfirm}
                                            onChange={(e) => setRegPasswordConfirm(e.target.value)}
                                            required
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? "Oluşturuluyor..." : "Hesap Oluştur"}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>

                    <TabsContent value="resident">
                        <Card>
                            <CardHeader>
                                <CardTitle>Sakin Girişi</CardTitle>
                                <CardDescription>6 haneli erişim kodunuzu girin, gerekirse apartman kodunu değiştirin</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleResidentLogin}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="buildingCode">Apartman Kodu (Opsiyonel)</Label>
                                        <Input
                                            id="buildingCode"
                                            type="text"
                                            placeholder="ABC123"
                                            maxLength={6}
                                            value={buildingCode}
                                            onChange={(e) => setBuildingCode(e.target.value.toUpperCase())}
                                            className="text-center tracking-[0.25em] font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground text-center">
                                            Başka bir apartmana giriş yapacaksanız önce bu kodu güncelleyin
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="accessCode">Erişim Kodu</Label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="accessCode"
                                                type="text"
                                                placeholder="1A2B3C"
                                                maxLength={6}
                                                value={accessCode}
                                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                                className="pl-10 text-center text-2xl tracking-widest font-mono"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">
                                            Erişim kodunuzu yöneticinizden alabilirsiniz
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isLoading || accessCode.length !== 6 || (buildingCode.length > 0 && buildingCode.length !== 6)}
                                    >
                                        {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
                                    </Button>
                                    <Button type="button" variant="outline" className="w-full" onClick={handleResetBuildingSelection}>
                                        Apartman Seçimini Sıfırla
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Login;
