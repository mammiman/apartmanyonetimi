import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateAndSaveAccessCode, supabase } from '@/lib/supabase';

interface AccessCodeGeneratorProps {
    apartmentNo: number;
    residentName: string;
    onClose: () => void;
    isOpen?: boolean;
}

export const AccessCodeGenerator = ({ apartmentNo, residentName, onClose }: AccessCodeGeneratorProps) => {
    const [accessCode, setAccessCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Bilesen acildiginda mevcut kodu kontrol et (once DB, sonra localStorage)
    useEffect(() => {
        const checkExistingCode = async () => {
            setIsLoading(true);
            try {
                // 1) Supabase'den kontrol et
                const { data, error } = await supabase
                    .from('apartments')
                    .select('access_code')
                    .eq('apartment_number', apartmentNo)
                    .maybeSingle();

                if (!error && data?.access_code) {
                    setAccessCode(data.access_code);
                    setIsLoading(false);
                    return;
                }
            } catch (err) {
                console.warn('DB access code check failed:', err);
            }

            // 2) Fallback: localStorage
            const accessCodes = JSON.parse(localStorage.getItem('accessCodes') || '{}');
            if (accessCodes[apartmentNo]?.code) {
                setAccessCode(accessCodes[apartmentNo].code);
            }
            setIsLoading(false);
        };

        checkExistingCode();
    }, [apartmentNo]);

    const generateCode = async () => {
        setIsLoading(true);
        try {
            const code = await generateAndSaveAccessCode(apartmentNo, residentName);
            setAccessCode(code);
            toast.success(`Daire ${apartmentNo} icin yeni erisim kodu olusturuldu.`);
        } catch (err) {
            console.error('Kod olusturma hatasi:', err);
            toast.error('Erisim kodu olusturulamadi.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(accessCode);
        toast.success('Erisim kodu kopyalandi');
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Erisim Kodu</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Daire</div>
                        <div className="text-lg font-bold">{apartmentNo} - {residentName}</div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Kontrol ediliyor...</span>
                        </div>
                    ) : !accessCode ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Bu daire icin henuz erisim kodu olusturulmamis.
                            </p>
                            <Button onClick={generateCode} className="w-full">
                                Kod Olustur
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 pt-2">
                            <div className="space-y-2">
                                <Label className="text-base font-semibold text-slate-900 dark:text-slate-100">Erisim Kodu</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={accessCode}
                                        readOnly
                                        className="font-mono text-center font-bold tracking-[0.2em] text-xl h-12 bg-white dark:bg-slate-800 border-2 border-primary/20 text-primary uppercase shadow-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={copyToClipboard}
                                        title="Kodu Kopyala"
                                        className="h-12 w-12 border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </Button>
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-2 font-medium">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Hazir! Kodu kopyalayip sakine gonderebilirsiniz.
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Bu kod veritabaninda kayitlidir ve herhangi bir cihazdan kullanilabilir.
                                </p>
                            </div>

                            <div className="flex justify-center pt-2">
                                <Button variant="ghost" size="sm" onClick={generateCode} className="text-muted-foreground text-xs hover:text-primary">
                                    <RefreshCw className="w-3 h-3 mr-1" /> Yeni Kod Olustur
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
