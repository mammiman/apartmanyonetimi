import { Layout } from "@/components/Layout";
import { useData } from "@/context/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Building2, Calendar, Download, LogOut, AlertCircle,
    CheckCircle2, ShieldAlert, TrendingDown, ChevronDown, ChevronUp, Eye, RefreshCw
} from "lucide-react";
import { MONTHS, formatCurrency, formatNumber } from "@/data/initialData";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

const MONTHS_TR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

const ResidentDashboard = () => {
    const { dues, apartments, monthlyDuesAmount, expenseItems, annualElevatorFee, ledger, year, refreshData } = useData();
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const navigate = useNavigate();

    const handleRefresh = async () => {
        setIsManualRefreshing(true);
        await refreshData(true);
        setIsManualRefreshing(false);
        toast.success("Veriler güncellendi");
    };

    const [showDuesTable, setShowDuesTable] = useState(false);
    const [showExpenseTable, setShowExpenseTable] = useState(false);

    const residentSessionStr = localStorage.getItem('residentSession');
    const residentSession = JSON.parse(residentSessionStr || '{}');
    const apartmentId = residentSession.apartmentId;

    let myApartment = apartments.find(apt => apt.daireNo === apartmentId);
    let myDues = dues.find(d => d.daireNo === apartmentId);

    // Fallback: localStorage'da daire verisi yoksa (farklı cihazdan giriş),
    // residentSession'daki bilgileri kullan
    if (!myApartment && apartmentId && residentSession.residentName) {
        myApartment = {
            daireNo: apartmentId,
            sakinAdi: residentSession.residentName,
            mulkSahibi: '',
            asansorTabi: true,
        };
    }
    if (!myDues && apartmentId) {
        myDues = {
            daireNo: apartmentId,
            sakinAdi: residentSession.residentName || '',
            devredenBorc2024: 0,
            odemeler: {},
            extraFees: {},
            asansorOdemesi: 0,
            toplamOdenen: 0,
            borc: 0,
            gecikmeCezasi: 0,
            odenecekToplamBorc: 0
        };
    }

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth();
    const currentMonthName = MONTHS[currentMonthIndex];

    const handleLogout = () => {
        localStorage.removeItem('residentSession');
        toast.success('Çıkış yapıldı');
        navigate('/login');
    };

    if (!myApartment || !myDues) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-screen p-4">
                    <p className="text-lg text-muted-foreground mb-4">Oturum bilgisi bulunamadı.</p>
                    <Button onClick={() => navigate('/login')}>Giriş Yap</Button>
                </div>
            </Layout>
        );
    }

    const isManager = myApartment.isManager || false;

    let totalDuesAccrued = 0;
    let totalDuesPaid = 0;
    MONTHS.forEach((month, idx) => {
        if (!isManager && idx <= currentMonthIndex) totalDuesAccrued += monthlyDuesAmount;
        totalDuesPaid += (myDues.odemeler?.[month] || 0);
    });

    const totalElevatorAccrued = myApartment.asansorTabi ? annualElevatorFee : 0;
    const totalElevatorPaid = myDues.asansorOdemesi || 0;

    let totalLateFee = 0;
    MONTHS.forEach((month, idx) => {
        if (!isManager && idx < currentMonthIndex) {
            const paid = myDues.odemeler?.[month] || 0;
            if (paid < monthlyDuesAmount) totalLateFee += (monthlyDuesAmount - paid) * 0.05;
        }
    });

    const netDuesDebt = totalDuesAccrued - totalDuesPaid;
    const netElevatorDebt = totalElevatorAccrued - totalElevatorPaid;
    const totalDebt = (myDues.devredenBorc2024 || 0) + netDuesDebt + netElevatorDebt + totalLateFee;

    // 3 ay üst üste ödeme yapmama kontrolü
    let consecutiveUnpaid = 0;
    let maxConsecutive = 0;
    for (let i = 0; i <= currentMonthIndex; i++) {
        const paid = myDues.odemeler?.[MONTHS[i]] || 0;
        if (!isManager && paid < monthlyDuesAmount) {
            consecutiveUnpaid++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveUnpaid);
        } else {
            consecutiveUnpaid = 0;
        }
    }
    const hasIcraRisk = maxConsecutive >= 3 && !isManager;
    const currentMonthPaid = (myDues.odemeler?.[currentMonthName] || 0) >= monthlyDuesAmount;

    // İşletme defterinden gerçek giderler (kategori dahil)
    const allLedgerExpenses: { ay: string; aciklama: string; kategori: string; tutar: number; tarih: string }[] = [];
    MONTHS_TR.forEach(month => {
        (ledger[month]?.giderler || []).forEach(g => {
            let desc = g.displayAciklama || g.aciklama;
            if (String(desc).startsWith('devir_from_')) {
                desc = `${String(desc).replace('devir_from_', '')} ayından devir`;
            }
            allLedgerExpenses.push({ ay: month, aciklama: desc, kategori: g.kategori || '', tutar: g.tutar, tarih: g.tarih || '' });
        });
    });
    const totalLedgerExpense = allLedgerExpenses.reduce((s, g) => s + g.tutar, 0);
    const nonManagerCount = apartments.filter(a => !a.isManager).length || 1;
    const myShareTotal = totalLedgerExpense / nonManagerCount;

    // Export
    const handleExport = () => {
        const headers = ['Ay', 'Aidat Tutarı', 'Ödenen', 'Durum'];
        const rows: any[] = MONTHS.filter((_, idx) => idx <= currentMonthIndex).map((month) => {
            const paid = myDues.odemeler?.[month] || 0;
            let status = "ÖDENMEDİ";
            if (paid >= monthlyDuesAmount) status = "ÖDENDİ";
            else if (paid > 0) status = "KISMİ";
            return [month, isManager ? 0 : monthlyDuesAmount, paid, status];
        });
        const coloredCells: { row: number; col: number; color: 'green' | 'red' | 'yellow' }[] = [];
        rows.forEach((row, idx) => {
            if (row[3] === 'ÖDENDİ') coloredCells.push({ row: idx, col: 3, color: 'green' });
            if (row[3] === 'ÖDENMEDİ') coloredCells.push({ row: idx, col: 3, color: 'red' });
            if (row[3] === 'KISMİ') coloredCells.push({ row: idx, col: 3, color: 'yellow' });
        });
        rows.push(['TOPLAM', totalDuesAccrued, totalDuesPaid, '']);
        import("@/lib/exportUtils").then(({ exportToExcel }) => {
            exportToExcel(`Daire_${myApartment.daireNo}_Ekstre`, {
                title: `Daire ${myApartment.daireNo} - ${myApartment.sakinAdi} Ekstre`,
                subtitle: `Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`,
                headers, rows, coloredCells
            });
            toast.success("Ekstre indirildi.");
        });
    };

    return (
        <Layout>
            <div className="animate-fade-in space-y-4 max-w-3xl mx-auto p-3 md:p-6 mb-20">

                {/* ═══ İCRA UYARISI ═══ */}
                {hasIcraRisk && (
                    <div className="relative overflow-hidden rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700 shadow-xl">
                        <div className="relative p-5 flex flex-col sm:flex-row items-center gap-4 text-white">
                            <div className="flex-shrink-0 bg-white/20 rounded-full p-3">
                                <ShieldAlert className="w-8 h-8" />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <h2 className="text-xl font-extrabold uppercase mb-1">⚠️ İcra Takibi Uyarısı</h2>
                                <p className="text-red-100 text-sm">
                                    <strong>{maxConsecutive} ay</strong> üst üste aidat ödemesi yapılmamıştır.
                                    Yasal düzenlemeler gereğince <strong>icra takibi başlatılacaktır.</strong>{" "}
                                    Birikmiş borcunuzu (<strong>{formatCurrency(totalDebt)}</strong>) lütfen en kısa sürede ödeyiniz.
                                </p>
                            </div>
                            <div className="bg-white/20 rounded-xl px-4 py-2 text-center shrink-0">
                                <p className="text-xs text-red-200 uppercase tracking-wider">Toplam Borç</p>
                                <p className="text-2xl font-black">{formatCurrency(totalDebt)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TEŞEKKÜR ═══ */}
                {currentMonthPaid && !isManager && (
                    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg">
                        <div className="relative p-5 flex items-center gap-4 text-white">
                            <div className="flex-shrink-0 bg-white/20 rounded-full p-3">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold mb-0.5">✅ Teşekkür Ederiz!</h2>
                                <p className="text-emerald-100 text-sm">
                                    {currentMonthName} ayı aidatınızı zamanında ödediğiniz için teşekkür ederiz, {myApartment.sakinAdi}! 🙏
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="bg-blue-100 text-blue-700 p-2 rounded-xl">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Daire {myApartment.daireNo}</h1>
                                <p className="text-sm text-muted-foreground">{myApartment.sakinAdi}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 text-xs mt-2 text-gray-500 flex-wrap">
                            <span>Aylık Aidat: <strong className="text-gray-900 dark:text-gray-200">{formatCurrency(monthlyDuesAmount)}</strong></span>
                            {myApartment.asansorTabi && <span>Asansör: <strong>{formatCurrency(annualElevatorFee)}</strong>/yıl</span>}
                            <span className={`font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {totalDebt > 0 ? `⚠ ${formatCurrency(totalDebt)} borç` : '✓ Borç yok'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={isManualRefreshing}
                            size="sm"
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isManualRefreshing ? 'animate-spin' : ''}`} />
                            {isManualRefreshing ? 'Yenileniyor...' : 'Yenile'}
                        </Button>
                        <Button variant="outline" onClick={handleExport} size="sm" className="gap-2">
                            <Download className="w-4 h-4" /> Ekstre
                        </Button>
                        <Button variant="destructive" onClick={handleLogout} size="sm" className="gap-2">
                            <LogOut className="w-4 h-4" /> Çıkış
                        </Button>
                    </div>
                </div>

                {/* Bakiye Kartı */}
                <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
                    <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-center md:text-left flex-1">
                            <p className="text-slate-400 text-sm flex items-center gap-2 justify-center md:justify-start mb-1">
                                <Calendar className="w-4 h-4" /> {currentMonthName} {year} — Hesap Durumu
                            </p>
                            <h2 className={`text-4xl font-bold mt-1 ${totalDebt > 1 ? "text-red-400" : totalDebt < -1 ? "text-emerald-400" : "text-white"}`}>
                                {totalDebt > 1 ? `${formatCurrency(totalDebt)} Borç` : totalDebt < -1 ? `${formatCurrency(Math.abs(totalDebt))} Alacak` : "Borcunuz Yoktur"}
                            </h2>
                            {totalDebt > 1 && !hasIcraRisk && (
                                <p className="text-sm text-red-300 mt-2 flex items-center gap-2 bg-red-500/10 p-2 rounded w-fit">
                                    <AlertCircle className="w-4 h-4" /> Lütfen ödemenizi yapınız.
                                </p>
                            )}
                            {isManager && <p className="text-xs text-slate-400 mt-2 italic">Yönetici hesabı — aidat muafiyeti</p>}
                        </div>
                        <div className="flex gap-4 md:gap-6 text-center bg-white/10 p-4 rounded-xl border border-white/10 w-full md:w-auto justify-center">
                            <div>
                                <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">AİDAT BORCU</p>
                                <p className="text-lg font-bold">{formatCurrency(netDuesDebt > 0 ? netDuesDebt : 0)}</p>
                            </div>
                            {myApartment.asansorTabi && (
                                <div>
                                    <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">ASANSÖR</p>
                                    <p className="text-lg font-bold">{formatCurrency(netElevatorDebt > 0 ? netElevatorDebt : 0)}</p>
                                </div>
                            )}
                            {(myDues.devredenBorc2024 > 0 || totalLateFee > 0) && (
                                <div>
                                    <p className="text-[10px] text-slate-300 uppercase tracking-wider mb-1">DEVİR/GECİKME</p>
                                    <p className="text-lg font-bold">{formatCurrency((myDues.devredenBorc2024 || 0) + totalLateFee)}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Aksiyon Butonları */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowDuesTable(!showDuesTable)}
                        className={`h-14 flex flex-col gap-0.5 border-2 transition-all ${showDuesTable ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700' : 'hover:border-blue-300'}`}
                    >
                        <span className="flex items-center gap-2 font-semibold">
                            <Eye className="w-4 h-4" />
                            Aidat Hareketleri
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {showDuesTable ? 'Gizle' : 'Göster'}
                        </span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowExpenseTable(!showExpenseTable)}
                        className={`h-14 flex flex-col gap-0.5 border-2 transition-all ${showExpenseTable ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700' : 'hover:border-red-300'}`}
                    >
                        <span className="flex items-center gap-2 font-semibold">
                            <TrendingDown className="w-4 h-4" />
                            Apartman Giderleri
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {showExpenseTable ? 'Gizle' : 'Göster'}
                        </span>
                    </Button>
                </div>

                {/* Aidat Hareketleri Tablosu (gizlenebilir) */}
                {showDuesTable && (
                    <Card className="shadow-md animate-fade-in">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                {year} Aidat Hareketleri
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowDuesTable(false)}>
                                <ChevronUp className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-500">Ay</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-500">Tahakkuk</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-500">Ödenen</th>
                                            <th className="px-4 py-3 text-center font-semibold text-gray-500">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MONTHS.map((month, idx) => {
                                            const isFuture = idx > currentMonthIndex;
                                            const paid = myDues.odemeler?.[month] || 0;
                                            const fullyPaid = !isManager && paid >= monthlyDuesAmount;
                                            const partiallyPaid = paid > 0 && paid < monthlyDuesAmount;
                                            const unpaid = !isManager && paid < monthlyDuesAmount && !isFuture;

                                            let badge;
                                            if (isManager) badge = <span className="text-xs text-purple-500 italic">Muaf</span>;
                                            else if (isFuture) badge = <span className="text-gray-400 text-xs italic">Planlanan</span>;
                                            else if (fullyPaid) badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3 h-3" />Ödendi</span>;
                                            else if (partiallyPaid) badge = <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Kısmi</span>;
                                            else badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800"><AlertCircle className="w-3 h-3" />Ödenmedi</span>;

                                            return (
                                                <tr key={month} className={`border-b last:border-0 transition-colors ${isFuture ? 'opacity-40 bg-slate-50/30' : unpaid ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}>
                                                    <td className="px-4 py-2.5 font-medium">{month}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{isManager ? '—' : formatCurrency(monthlyDuesAmount)}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono">{paid > 0 ? formatCurrency(paid) : '—'}</td>
                                                    <td className="px-4 py-2.5 text-center">{badge}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                                            <td className="px-4 py-3 text-sm">TOPLAM</td>
                                            <td className="px-4 py-3 text-right text-sm">{formatCurrency(totalDuesAccrued)}</td>
                                            <td className="px-4 py-3 text-right text-sm">{formatCurrency(totalDuesPaid)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-bold text-sm ${totalDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {totalDebt > 0 ? `${formatCurrency(totalDebt)} borç` : 'Ödendi ✓'}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Gider Tablosu (gizlenebilir) */}
                {showExpenseTable && (
                    <Card className="shadow-md animate-fade-in">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-500" />
                                {year} Apartman Giderleri
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowExpenseTable(false)}>
                                <ChevronUp className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {/* Özet */}
                            <div className="flex gap-4 mb-4 bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-100 dark:border-red-900/40">
                                <div className="flex-1">
                                    <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Toplam Gider</p>
                                    <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalLedgerExpense)}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Tahmini Payınız</p>
                                    <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(myShareTotal)}</p>
                                </div>
                            </div>

                            {allLedgerExpenses.length > 0 ? (
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Ay</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Tarih</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Kategori</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Açıklama</th>
                                                <th className="px-3 py-2 text-right font-semibold text-gray-500">Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allLedgerExpenses.map((g, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-medium">{g.ay}</td>
                                                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{g.tarih || '—'}</td>
                                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {g.kategori ? (
                                                            <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px]">{g.kategori}</span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{g.aciklama}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400 whitespace-nowrap">{formatCurrency(g.tutar)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                                                <td colSpan={4} className="px-3 py-2">TOPLAM</td>
                                                <td className="px-3 py-2 text-right text-red-700 dark:text-red-300">{formatCurrency(totalLedgerExpense)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : expenseItems.length > 0 ? (
                                <div className="space-y-1.5">
                                    {expenseItems.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                            <span className="text-xs text-slate-700 dark:text-slate-300">{item.description}</span>
                                            <span className="text-xs font-bold text-red-600">{formatNumber(item.amount / item.quantity)} ₺</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-6">Henüz gider kaydı bulunmuyor.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

            </div>
        </Layout>
    );
};

export default ResidentDashboard;
