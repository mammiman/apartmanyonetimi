import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
// import { duesSchedule, monthlySummary } from "@/data/initialData"; // Removed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, MONTHS } from "@/data/initialData";

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Pencil,
  FileText,
  Settings,
  Calendar,
  RotateCcw,
  ChevronDown,
  Check,
  X,
  Plus,
  Trash2,
  Building2,
  Download,
  ScrollText,
  Printer
} from "lucide-react";
import { useData } from "@/context/DataContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Input } from "@/components/ui/input";
import { printReceipt } from "@/lib/printUtils"; // Import moved here


const Dashboard = () => {
  const {
    dues: duesSchedule,
    monthlySummary,
    year,
    startNewYear,
    availableYears,
    switchYear,
    expenseItems = [], // Default to empty array if undefined
    updateExpenseItem,
    apartmentName,
    updateApartmentName,
    updateMonthlyDuesAmount,
    updateMonthlySummaryRow,
    addExpenseItem,
    removeExpenseItem,
    ledger,
    annualElevatorFee,
    updateAnnualElevatorFee
  } = useData();

  const handlePrintReceipt = (data: { type: 'gelir' | 'gider', amount: number, desc: string, date: string, name: string }) => {
    printReceipt({
      ...data,
      apartmentName: apartmentName || "SAFFET SABANCI APT.", // Fallback if name missing
    });
  };

  const handlePrintTable = (title: string, headers: string[], rows: (string | number)[][]) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
              <html>
                  <title>${title}</title>
                  <style>
                      @page { size: A4; margin: 1cm; }
                      body { font-family: 'Arial', sans-serif; font-size: 10pt; }
                      h2 { text-align: center; margin-bottom: 20px; }
                      table { width: 100%; border-collapse: collapse; }
                      th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
                      th { background-color: #f0f0f0; font-weight: bold; }
                      tr:nth-child(even) { background-color: #fafafa; }
                      .red { color: red; }
                      .green { color: green; }
                  </style>
              </head>
              <body>
                  <h2>${title}</h2>
                  <table>
                      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                      <tbody>
                          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                      </tbody>
                  </table>
                  <script>window.onload = () => { window.print(); }</script>
              </body>
              </html>
          `);
      printWindow.document.close();
    }
  };

  const handlePrintLedger = () => {
    const incomeRows: any[] = [];
    const expenseRows: any[] = [];
    const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

    let totalIncome = 0;
    let totalExpense = 0;

    months.forEach(month => {
      const data = ledger[month];
      if (data) {
        data.gelirler?.forEach(g => {
          incomeRows.push([month, g.tarih || '-', g.kategori, g.aciklama, formatCurrency(g.tutar)]);
          totalIncome += g.tutar;
        });
        data.giderler?.forEach(g => {
          expenseRows.push([month, g.tarih || '-', g.kategori, g.aciklama, formatCurrency(g.tutar)]);
          totalExpense += g.tutar;
        });
      }
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
            <html>
                <head>
                    <title>${year} YILI İŞLETME DEFTERİ</title>
                    <style>
                        @page { size: A4 landscape; margin: 1cm; }
                        body { font-family: 'Arial', sans-serif; font-size: 9pt; }
                        h2 { text-align: center; margin-bottom: 20px; }
                        .container { display: flex; gap: 20px; }
                        .column { flex: 1; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
                        th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
                        td.amount { text-align: right; }
                        .total-row { font-weight: bold; background-color: #e6e6e6; }
                        .header-green { background-color: #e6fffa; color: #047857; }
                        .header-red { background-color: #fef2f2; color: #b91c1c; }
                    </style>
                </head>
                <body>
                    <h2>${year} YILI İŞLETME DEFTERİ</h2>
                    <div class="container">
                        <div class="column">
                            <h3 style="text-align:center; color:#047857;">GELİRLER</h3>
                            <table>
                                <thead>
                                    <tr class="header-green">
                                        <th>Ay</th><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${incomeRows.map(row => `<tr>${row.map((cell: any, i: number) => `<td class="${i === 4 ? 'amount' : ''}">${cell}</td>`).join('')}</tr>`).join('')}
                                    <tr class="total-row">
                                        <td colspan="4" style="text-align:right">TOPLAM GELİR</td>
                                        <td class="amount">${formatCurrency(totalIncome)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="column">
                            <h3 style="text-align:center; color:#b91c1c;">GİDERLER</h3>
                             <table>
                                <thead>
                                    <tr class="header-red">
                                         <th>Ay</th><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${expenseRows.map(row => `<tr>${row.map((cell: any, i: number) => `<td class="${i === 4 ? 'amount' : ''}">${cell}</td>`).join('')}</tr>`).join('')}
                                     <tr class="total-row">
                                        <td colspan="4" style="text-align:right">TOPLAM GİDER</td>
                                        <td class="amount">${formatCurrency(totalExpense)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                     <div style="margin-top: 20px; text-align: right; font-weight: bold; font-size: 1.2em;">
                        GENEL BAKİYE: ${formatCurrency(totalIncome - totalExpense)}
                    </div>
                    <script>window.onload = () => { window.print(); }</script>
                </body>
            </html>
        `);
      printWindow.document.close();
    }
  };

  const handlePrintSchedule = () => {
    const rows = duesSchedule.map(apt => [
      apt.daireNo,
      apt.sakinAdi,
      (apt.devredenBorc2024 > 0 ? formatCurrency(apt.devredenBorc2024) : '-'),
      MONTHS.map(m => apt.odemeler?.[m] ? 'X' : '').join(' '), // Simplified for print
      formatCurrency(Object.values(apt.odemeler || {}).reduce((a, b) => a + b, 0))
    ]);
    // A4 width limitation makes the full month grid hard. Let's simplify or group.
    // For simple list:
    const simpleRows = duesSchedule.map(apt => [
      apt.daireNo,
      apt.sakinAdi,
      formatCurrency(apt.devredenBorc2024),
      formatCurrency(Object.values(apt.odemeler || {}).reduce((a, b) => a + b, 0)),
      formatCurrency((apt.devredenBorc2024 + 12 * 500) - Object.values(apt.odemeler || {}).reduce((a, b) => a + b, 0)) // Approx calculation
    ]);
    handlePrintTable(`${year} YILI ÖDEME LİSTESİ`, ['Daire', 'Sakin', 'Devreden', 'Toplam Ödenen', 'Bakiye'], simpleRows);
  };

  const handleLedgerExport = () => {
    const incomeRows: any[] = [];
    const expenseRows: any[] = [];
    const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

    let totalIncome = 0;
    let totalExpense = 0;

    months.forEach(month => {
      const data = ledger[month];
      if (data) {
        data.gelirler?.forEach(g => {
          incomeRows.push([month, g.tarih || '-', g.kategori, g.aciklama, g.tutar]);
          totalIncome += g.tutar;
        });
        data.giderler?.forEach(g => {
          expenseRows.push([month, g.tarih || '-', g.kategori, g.aciklama, g.tutar]);
          totalExpense += g.tutar;
        });
      }
    });

    // Combine side by side
    const combinedRows: any[] = [];
    const maxLen = Math.max(incomeRows.length, expenseRows.length);

    for (let i = 0; i < maxLen; i++) {
      const inc = incomeRows[i] || ['', '', '', '', ''];
      const exp = expenseRows[i] || ['', '', '', '', ''];
      combinedRows.push([...inc, '', ...exp]); // Empty column in between
    }

    // Add totals
    combinedRows.push(['', '', '', 'TOPLAM GELİR', totalIncome, '', '', '', '', 'TOPLAM GİDER', totalExpense]);

    const coloredCells: { row: number, col: number, color: 'green' | 'red' | 'yellow' }[] = [];
    // Can add styling for totals or headers if supported utility allows

    import("@/lib/exportUtils").then(({ exportToExcel }) => {
      exportToExcel(`${year}_Isletme_Defteri_YanYana`, {
        title: `${apartmentName} - ${year} Yılı İşletme Defteri`,
        subtitle: `Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`,
        headers: ['GELİR AY', 'TARİH', 'KATEGORİ', 'AÇIKLAMA', 'TUTAR', '', 'GİDER AY', 'TARİH', 'KATEGORİ', 'AÇIKLAMA', 'TUTAR'],
        rows: combinedRows,
        coloredCells: [] // Optional
      });
      toast.success("İşletme defteri (yan yana) indirildi.");
    });
  };

  const handleAddExpense = () => {
    addExpenseItem({
      description: "YENİ GİDER KALEMİ",
      amount: 0,
      quantity: 23, // Varsayılan daire sayısı
      unit: "TL"
    });
  };

  const [isEditingExpenses, setIsEditingExpenses] = useState(false);
  const [isEditingIcmal, setIsEditingIcmal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(apartmentName);
  // Banka toplam override - localStorage'da kalıcı
  const [bankaToplami, setBankaToplami] = useState<number | null>(() => {
    const saved = localStorage.getItem('icmal_banka_toplam');
    return saved !== null ? parseFloat(saved) : null;
  });
  const saveBankaToplami = (v: number) => {
    setBankaToplami(v);
    localStorage.setItem('icmal_banka_toplam', String(v));
  };

  // useEffect to sync tempName
  useEffect(() => { setTempName(apartmentName); }, [apartmentName]);

  const saveName = () => {
    updateApartmentName(tempName);
    setIsEditingName(false);
  };

  // Calculate Summary Metrics
  const totalBorc = duesSchedule.reduce((sum, item) => sum + (item.odenecekToplamBorc < 0 ? Math.abs(item.odenecekToplamBorc) : 0), 0);
  const totalAlacak = duesSchedule.reduce((sum, item) => sum + (item.odenecekToplamBorc > 0 ? item.odenecekToplamBorc : 0), 0);
  const totalGelir = monthlySummary.reduce((sum, item) => sum + item.gelir, 0);

  // Calculate Expense Totals
  const totalMonthlyExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const totalPerUnit = expenseItems.reduce((sum, item) => sum + (item.amount / item.quantity), 0);

  // Suggested Dues (Round to nearest 10)
  const suggestedDues = Math.ceil(totalPerUnit / 10) * 10;

  const totalGider = monthlySummary.reduce((sum, item) => sum + item.gider, 0);
  const kasaDurumu = totalGelir - totalGider;

  // --- İcmal Tablosu Hesaplamaları (DOĞRUDAN LEDGER'DAN) ---
  const ICMAL_MONTHS = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

  // Devir satırı: monthlySummary'den önceki yıldan devir tutarını al
  const devirRow = monthlySummary.find(m => m.ay.includes('Devir'));
  const devirGelir = devirRow ? devirRow.gelir : 0;

  // Kümülatif kasa (başlangıç = devir bakiyesi)
  let cumulativeKasa = devirGelir;

  const icmalRows = ICMAL_MONTHS.map(month => {
    const monthLedger = ledger[month];

    // GELİR ve GİDER: doğrudan ledger toplamları
    const gelir = monthLedger
      ? (monthLedger.gelirler || []).reduce((s, r) => s + r.tutar, 0)
      : 0;
    const gider = monthLedger
      ? (monthLedger.giderler || []).reduce((s, r) => s + r.tutar, 0)
      : 0;
    const fark = gelir - gider;
    cumulativeKasa += fark;

    // ASANSÖR: 'Asansör Demirbaş' kategorili gelirler
    const asansor = monthLedger
      ? (monthLedger.gelirler || [])
        .filter(r => r.kategori === 'Asansör Demirbaş')
        .reduce((s, r) => s + r.tutar, 0)
      : 0;

    // DİYAFON: 'Diyafon' kategorisi VEYA açıklamada 'diyafon' geçen giderler
    const diyafon = monthLedger
      ? (monthLedger.giderler || [])
        .filter(r => r.kategori === 'Diyafon' || r.aciklama?.toLowerCase().includes('diyafon'))
        .reduce((s, r) => s + r.tutar, 0)
      : 0;

    // monthlySummary'den banka bakiyesi (manuel düzenleme destekli)
    const summaryRow = monthlySummary.find(m => m.ay === month);
    const banka = summaryRow?.banka ?? cumulativeKasa;

    return { month, gelir, gider, asansor, diyafon, kasa: cumulativeKasa, banka, fark };
  });

  const icmalToplam = {
    gelir: icmalRows.reduce((s, r) => s + r.gelir, 0) + devirGelir,
    gider: icmalRows.reduce((s, r) => s + r.gider, 0),
    asansor: icmalRows.reduce((s, r) => s + r.asansor, 0),
    diyafon: icmalRows.reduce((s, r) => s + r.diyafon, 0),
    kasa: cumulativeKasa,
    banka: cumulativeKasa,
    fark: icmalRows.reduce((s, r) => s + r.fark, 0) + devirGelir,
  };

  const fmt = (v: number) => v === 0 ? '0,00' : formatNumber(v);


  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="text-2xl font-bold h-10 w-96"
                  />
                  <Button size="icon" variant="ghost" onClick={saveName} className="text-green-600">
                    <Check className="w-5 h-5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} className="text-red-600">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{apartmentName}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400">Genel Bakış ve Finansal Durum</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="shadow-sm">
              <Link to="/isletme-defteri">
                <FileText className="mr-2 h-4 w-4" />
                İşletme Defteri
              </Link>
            </Button>
            <Button asChild className="shadow-sm">
              <Link to="/aidat">
                <Pencil className="mr-2 h-4 w-4" />
                Aidatları Düzenle
              </Link>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrintLedger}>
              <Printer className="w-4 h-4 mr-2" />
              A4 Yazdır
            </Button>
            <Button variant="outline" size="sm" onClick={handleLedgerExport}>
              <Download className="w-4 h-4 mr-2" />
              Excel İndir
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="shadow-sm">
                  <Settings className="mr-2 h-4 w-4" />
                  İşlemler
                  <ChevronDown className="ml-1 w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sistem İşlemleri</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableYears && availableYears.length > 1 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Yıl Seçimi</DropdownMenuLabel>
                    {availableYears.map(y => (
                      <DropdownMenuItem key={y} onClick={() => switchYear(y)} className={year === y ? "bg-accent" : ""}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {y}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={startNewYear} className="text-primary focus:bg-primary/10 cursor-pointer">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Yeni Yıl Oluştur ({year + 1})</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link to="/isletme-defteri" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Güncel Kasa (Net)</CardTitle>
                <span className="text-2xl">💰</span>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${kasaDurumu >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(kasaDurumu)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Toplam gelir - gider farkı
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="h-full border-l-4 border-l-teal-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Banka Bakiyesi</CardTitle>
              <span className="text-2xl">🏦</span>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(bankaToplami ?? icmalToplam.banka) >= 0 ? "text-teal-600" : "text-destructive"}`}>
                {formatCurrency(bankaToplami ?? icmalToplam.banka)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Banka hesap bakiyesi
              </p>
            </CardContent>
          </Card>

          <Link to="/aidat" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-l-destructive">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Alacak (Borçlar)</CardTitle>
                <span className="text-2xl">📉</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalBorc)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sakinlerin ödemesi gereken
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/daireler" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daireler</CardTitle>
                <span className="text-2xl">🏢</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {duesSchedule.length} <span className="text-sm font-normal text-muted-foreground">Aktif</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Toplam bağımsız bölüm
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/personel" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Personel</CardTitle>
                <span className="text-2xl">👨‍🔧</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  1 <span className="text-sm font-normal text-muted-foreground">Kişi</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Osman Koka
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* İcmal Tablosu - Excel Formatı - Düzenlenebilir */}
        <Card className="shadow-sm overflow-hidden border-2 border-amber-200 dark:border-amber-800">
          <CardHeader className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-950/60 dark:to-amber-950/60 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-center text-base font-bold tracking-widest flex-1">
              {year} AYLIK GELİR GİDER LİSTESİ
            </CardTitle>
            <Button
              variant={isEditingIcmal ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditingIcmal(!isEditingIcmal)}
              className={`ml-4 h-7 text-xs gap-1 ${isEditingIcmal ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-400 text-amber-700 hover:bg-amber-50'}`}
            >
              <Pencil className="w-3 h-3" />
              {isEditingIcmal ? 'Bitti' : 'Düzenle'}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: 'Arial, sans-serif' }}>
                <thead>
                  <tr className="bg-gray-800 text-white">
                    {['AYLAR', 'GELİR', 'GİDER', 'ASANSÖR', 'DİYAFON', 'KASA', 'BANKA', 'FARK'].map(h => (
                      <th key={h} className="border border-gray-600 px-3 py-2.5 text-center font-bold whitespace-nowrap text-[11px] tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Devir Satırı */}
                  {devirGelir > 0 && (
                    <tr className="bg-green-100 dark:bg-green-900/40 border-b-2 border-green-300">
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 font-extrabold text-center text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-800/40">{year - 1}</td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-right font-bold text-green-800 dark:text-green-300">
                        {isEditingIcmal ? (
                          <input type="number" className="w-full text-right bg-white/80 border border-green-400 rounded px-1 py-0.5 text-xs" defaultValue={devirGelir} onBlur={e => updateMonthlySummaryRow(devirRow?.ay || '2024 Devir', 'gelir', parseFloat(e.target.value) || 0)} />
                        ) : fmt(devirGelir)}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                      <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                    </tr>
                  )}
                  {/* Aylık Satırlar */}
                  {icmalRows.map((row, idx) => {
                    const isOdd = idx % 2 === 0;
                    const rowBg = isOdd ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-white dark:bg-slate-900';
                    const hasData = row.gelir > 0 || row.gider > 0;
                    const summary = monthlySummary.find(m => m.ay === row.month);
                    return (
                      <tr key={row.month} className={`${rowBg} hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors`}>
                        <td className={`border border-slate-300 dark:border-slate-600 px-3 py-2 font-extrabold text-center text-[11px] tracking-wide ${hasData ? 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-100' : 'text-slate-500'
                          }`}>{row.month}</td>

                        {/* GELİR */}
                        <td className={`border border-slate-300 dark:border-slate-600 px-1 py-1 text-right ${row.gelir > 0 ? 'bg-green-50 dark:bg-green-950/30' : ''
                          }`}>
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-green-300 rounded px-1 py-0.5 text-xs min-w-[70px]" defaultValue={row.gelir} onBlur={e => updateMonthlySummaryRow(row.month, 'gelir', parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className={row.gelir > 0 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}>{fmt(row.gelir)}</span>
                          )}
                        </td>

                        {/* GİDER */}
                        <td className={`border border-slate-300 dark:border-slate-600 px-1 py-1 text-right ${row.gider > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''
                          }`}>
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-red-300 rounded px-1 py-0.5 text-xs min-w-[70px]" defaultValue={row.gider} onBlur={e => updateMonthlySummaryRow(row.month, 'gider', parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className={row.gider > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400'}>{fmt(row.gider)}</span>
                          )}
                        </td>

                        {/* ASANSÖR */}
                        <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-right">
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-slate-300 rounded px-1 py-0.5 text-xs min-w-[60px]" defaultValue={row.asansor} onBlur={e => updateMonthlySummaryRow(row.month, 'asansor', parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">{row.asansor > 0 ? fmt(row.asansor) : ''}</span>
                          )}
                        </td>

                        {/* DİYAFON */}
                        <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-right">
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-slate-300 rounded px-1 py-0.5 text-xs min-w-[60px]" defaultValue={row.diyafon} onBlur={e => updateMonthlySummaryRow(row.month, 'diyafon' as any, parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">{row.diyafon > 0 ? fmt(row.diyafon) : ''}</span>
                          )}
                        </td>

                        {/* KASA */}
                        <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-right bg-yellow-50/50 dark:bg-yellow-950/10">
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-amber-300 rounded px-1 py-0.5 text-xs min-w-[60px]" defaultValue={row.kasa} onBlur={e => updateMonthlySummaryRow(row.month, 'kasa', parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className="text-slate-700 dark:text-slate-200 font-medium">{fmt(row.kasa)}</span>
                          )}
                        </td>

                        {/* BANKA */}
                        <td className="border border-slate-300 dark:border-slate-600 px-1 py-1 text-right bg-yellow-50/50 dark:bg-yellow-950/10">
                          {isEditingIcmal ? (
                            <input type="number" className="w-full text-right bg-white border border-amber-300 rounded px-1 py-0.5 text-xs min-w-[60px]" defaultValue={summary?.banka ?? row.banka} onBlur={e => updateMonthlySummaryRow(row.month, 'banka', parseFloat(e.target.value) || 0)} />
                          ) : (
                            <span className="text-slate-700 dark:text-slate-200 font-semibold">{fmt(summary?.banka ?? row.banka)}</span>
                          )}
                        </td>

                        {/* FARK */}
                        <td className={`border border-slate-300 dark:border-slate-600 px-3 py-2 text-right font-bold ${row.fark >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>{fmt(row.fark)}</td>
                      </tr>
                    );
                  })}
                  {/* Toplam Satırı */}
                  <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                    <td className="border border-gray-600 px-3 py-2.5 text-center font-extrabold tracking-widest">TOPLAM</td>
                    <td className="border border-gray-600 px-3 py-2.5 text-right text-green-300">{fmt(icmalToplam.gelir)}</td>
                    <td className="border border-gray-600 px-3 py-2.5 text-right text-red-300">{fmt(icmalToplam.gider)}</td>
                    <td className="border border-gray-600 px-3 py-2.5 text-right text-gray-300">{fmt(icmalToplam.asansor)}</td>
                    <td className="border border-gray-600 px-3 py-2.5 text-right text-gray-300">{fmt(icmalToplam.diyafon)}</td>
                    <td className="border border-gray-600 px-3 py-2.5 text-right text-amber-200">{fmt(icmalToplam.kasa)}</td>
                    <td className={`border border-gray-600 px-1 py-1 text-right text-amber-200 ${isEditingIcmal ? 'bg-amber-900/20' : ''}`}>
                      {isEditingIcmal ? (
                        <input
                          type="number"
                          className="w-full text-right bg-white/10 border border-amber-400 rounded px-1 py-0.5 text-xs text-white min-w-[70px]"
                          defaultValue={bankaToplami ?? icmalToplam.banka}
                          onBlur={e => saveBankaToplami(parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        <span className="font-semibold">{fmt(bankaToplami ?? icmalToplam.banka)}</span>
                      )}
                    </td>
                    <td className={`border border-gray-600 px-3 py-2.5 text-right font-extrabold ${icmalToplam.fark >= 0 ? 'text-green-300' : 'bg-red-800 text-red-200'
                      }`}>{fmt(icmalToplam.fark)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>



        {/* GRID LAYOUT FOR TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AYLIK ÖDEME HESABI */}
          <Card className="shadow-lg h-fit">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">{year} YILI AYLIK ÖDEME HESABI</CardTitle>
              <div className="flex gap-2">
                {isEditingExpenses && (
                  <Button size="sm" onClick={handleAddExpense} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="w-4 h-4 mr-1" /> Ekle
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingExpenses(!isEditingExpenses)}
                  className="bg-white/50 hover:bg-white/80 dark:bg-black/20"
                >
                  {isEditingExpenses ? <><Check className="w-4 h-4 mr-2" /> Bitti</> : <><Pencil className="w-4 h-4 mr-2" /> Düzenle</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2">
                      <th className="px-4 py-3 text-left font-bold w-12">Sıra</th>
                      <th className="px-4 py-3 text-left font-bold">Açıklama</th>
                      <th className="px-4 py-3 text-right font-bold">Tutar</th>
                      <th className="px-4 py-3 text-right font-bold">Adet</th>
                      <th className="px-4 py-3 text-right font-bold">Toplam</th>
                      <th className="px-4 py-3 text-center font-bold">Birim</th>
                      {isEditingExpenses && <th className="px-4 py-3 text-center font-bold w-10">Sil</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {expenseItems.map((item, index) => (
                      <tr key={item.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="px-4 py-3 text-center">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          {isEditingExpenses ? (
                            <Input
                              className="h-8"
                              value={item.description}
                              onChange={(e) => updateExpenseItem(item.id, { description: e.target.value })}
                            />
                          ) : item.description}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditingExpenses ? (
                            <Input
                              className="h-8 text-right w-24 ml-auto"
                              type="number"
                              value={item.amount}
                              onChange={(e) => updateExpenseItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                            />
                          ) : formatCurrency(item.amount).replace(' ₺', '')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditingExpenses ? (
                            <Input
                              className="h-8 text-right w-16 ml-auto"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateExpenseItem(item.id, { quantity: parseFloat(e.target.value) || 1 })}
                            />
                          ) : formatNumber(item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {formatNumber(item.amount / item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-center">{item.unit}</td>
                        {isEditingExpenses && (
                          <td className="px-4 py-3 text-center">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeExpenseItem(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-blue-50 dark:bg-blue-900/30 border-t-2 font-bold">
                      <td className="px-4 py-3" colSpan={2}>TOPLAM</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(totalMonthlyExpense).replace(' ₺', '')}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right text-lg">{formatNumber(totalPerUnit)}</td>
                      <td className="px-4 py-3 text-center">TL</td>
                      {isEditingExpenses && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ÖDEME PLANI */}
          <Card className="shadow-lg h-fit">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">{year} YILI ÖDEME PLANI</CardTitle>
              <div className="flex flex-col items-end gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePrintSchedule}>
                  <Printer className="w-3 h-3 mr-1" /> A4 Liste
                </Button>
                <div className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                  Hesaplanan Aidat: {formatCurrency(suggestedDues)} / Ay
                  {isEditingExpenses && (
                    <Button
                      size="sm"
                      variant="link"
                      className="ml-2 text-blue-600 underline h-auto p-0"
                      onClick={() => updateMonthlyDuesAmount(suggestedDues)}
                    >
                      Aidatı Güncelle ({suggestedDues} TL)
                    </Button>
                  )}
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-300 font-medium flex items-center gap-2">
                  <span>Yıllık Asansör Aidatı: <strong>{annualElevatorFee} TL</strong></span>
                  {isEditingExpenses && (
                    <div className="flex items-center gap-1 bg-white/50 rounded px-1">
                      <Input
                        type="number"
                        className="h-6 w-16 text-right text-xs"
                        value={annualElevatorFee}
                        onChange={(e) => updateAnnualElevatorFee(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2">
                      <th className="px-4 py-3 text-left font-bold">TARİH</th>
                      <th className="px-4 py-3 text-right font-bold">TUTAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'].map((month) => (
                      <tr key={month} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="px-4 py-3 font-medium">{month}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(suggestedDues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
