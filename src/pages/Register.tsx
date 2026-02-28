import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Shield } from "lucide-react";
import { signUp } from "@/lib/supabase";
import { toast } from "sonner";

const Register = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Şifreler eşleşmiyor");
            return;
        }

        if (password.length < 6) {
            toast.error("Şifre en az 6 karakter olmalıdır");
            return;
        }

        setIsLoading(true);

        try {
            await signUp(email, password, 'admin');
            toast.success("Yönetici hesabı oluşturuldu!");
            setIsOpen(false);
            setEmail("");
            setPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            toast.error(error.message || "Kayıt başarısız");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout>
            <div className="animate-fade-in">
                <div className="page-header mb-6">
                    <h1 className="page-title">Kullanıcı Yönetimi</h1>
                    <p className="page-subtitle">Yönetici hesapları oluşturun ve yönetin</p>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Yönetici Hesabı Oluştur
                            </CardTitle>
                            <CardDescription>
                                Yeni bir yönetici hesabı oluşturmak için aşağıdaki butona tıklayın
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Yeni Yönetici Ekle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Yeni Yönetici Hesabı</DialogTitle>
                                        <DialogDescription>
                                            Yönetici hesabı için e-posta ve şifre belirleyin
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleRegister}>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="reg-email">E-posta</Label>
                                                <Input
                                                    id="reg-email"
                                                    type="email"
                                                    placeholder="ornek@email.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="reg-password">Şifre</Label>
                                                <Input
                                                    id="reg-password"
                                                    type="password"
                                                    placeholder="En az 6 karakter"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="reg-confirm">Şifre Tekrar</Label>
                                                <Input
                                                    id="reg-confirm"
                                                    type="password"
                                                    placeholder="Şifreyi tekrar girin"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={isLoading}>
                                                {isLoading ? "Oluşturuluyor..." : "Hesap Oluştur"}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-50/50 border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-900">Bilgilendirme</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-blue-800 space-y-2">
                            <p>• Yönetici hesapları tüm verilere erişim sağlar</p>
                            <p>• Sakin erişim kodları Daire Yönetimi sayfasından oluşturulabilir</p>
                            <p>• Güvenlik için güçlü şifreler kullanın</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default Register;
