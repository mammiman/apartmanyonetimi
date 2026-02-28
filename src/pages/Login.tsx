import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, UserPlus } from "lucide-react";
import { signIn, signUp, signInWithAccessCode } from "@/lib/supabase";
import { toast } from "sonner";

const Login = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    // Admin login state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Admin register state
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regPasswordConfirm, setRegPasswordConfirm] = useState("");

    // Resident login state
    const [accessCode, setAccessCode] = useState("");

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            localStorage.removeItem('residentSession');
            await signIn(email, password);
            toast.success("Giriş başarılı!");
            navigate("/");
        } catch (error: any) {
            toast.error(error.message || "Giriş başarısız");
        } finally {
            setIsLoading(false);
        }
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
            await signInWithAccessCode(accessCode);
            toast.success("Giriş başarılı!");
            navigate("/resident");
        } catch (error: any) {
            toast.error("Geçersiz erişim kodu");
        } finally {
            setIsLoading(false);
        }
    };

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
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
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
                                <CardDescription>6 haneli erişim kodunuzu girin</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleResidentLogin}>
                                <CardContent className="space-y-4">
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
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isLoading || accessCode.length !== 6}>
                                        {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
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
