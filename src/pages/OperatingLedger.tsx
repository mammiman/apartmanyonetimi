import { Layout } from "@/components/Layout";
import { MONTHS, formatCurrency, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/data/initialData";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Printer, TrendingDown, TrendingUp, ArrowLeftRight, Receipt, FileText } from "lucide-react";
import { printReceipt } from "@/lib/printUtils";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewEntryForm {
  tarih: string;
  aciklama: string;
  tutar: string;
  kategori: string;
}

const MONTHS_TR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

const OperatingLedger = () => {
  const { ledger, addLedgerEntry, deleteLedgerEntry, year, apartments, apartmentName, updateDuesPayment, dues } = useData();

  // Varsayılan ay = gerçek günün ayı
  const currentRealMonth = MONTHS_TR[new Date().getMonth()];
  const [selectedMonth, setSelectedMonth] = useState(currentRealMonth);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<'gelir' | 'gider'>('gider');

  // Gider pusulası "Kime" diyalogu
  const [kimeDialogOpen, setKimeDialogOpen] = useState(false);
  const [kimeValue, setKimeValue] = useState('');
  const [pendingReceiptRow, setPendingReceiptRow] = useState<any>(null);

  const [newEntry, setNewEntry] = useState<NewEntryForm>({
    tarih: new Date().toLocaleDateString('tr-TR'),
    aciklama: '',
    tutar: '',
    kategori: ''
  });
  // Aidat: seçili daire no
  const [selectedDaireNo, setSelectedDaireNo] = useState<number | null>(null);

  const data = ledger[selectedMonth] || { giderler: [], gelirler: [] };
  const totalGider = data.giderler.reduce((s, r) => s + r.tutar, 0);
  const totalGelir = data.gelirler.reduce((s, r) => s + r.tutar, 0);
  const fark = totalGelir - totalGider;

  // Net farkı gelecek aya devir yaz
  const handleTransferToNextMonth = () => {
    const currentIdx = MONTHS_TR.indexOf(selectedMonth);
    if (currentIdx === -1 || currentIdx >= 11) {
      toast.error('Aralık ayından sonra devir yapılamaz. Yeni yıl başlatın.');
      return;
    }
    const nextMonth = MONTHS_TR[currentIdx + 1];
    const devirTag = `devir_from_${selectedMonth}`;

    // Önceki devir kayıtlarını temizle (hem gelir hem gider kontrolü)
    const nextData = ledger[nextMonth] || { giderler: [], gelirler: [] };
    const existingGelir = (nextData.gelirler || []).find((r: any) => r.aciklama === devirTag);
    const existingGider = (nextData.giderler || []).find((r: any) => r.aciklama === devirTag);

    if (existingGelir) deleteLedgerEntry(nextMonth, 'gelir', existingGelir.id);
    if (existingGider) deleteLedgerEntry(nextMonth, 'gider', existingGider.id);

    // Fark pozitifse sonraki aya Gelir, negatifse Gider olarak ekle
    const transferType = fark >= 0 ? 'gelir' : 'gider';

    // Küçük bir gecikme ile ekle (setLedger state güncellemeleri çakışmasın diye)
    setTimeout(() => {
      addLedgerEntry(nextMonth, transferType, {
        tarih: new Date().toLocaleDateString('tr-TR'),
        aciklama: devirTag,
        kategori: 'Devir',
        tutar: Math.abs(fark),
        tip: transferType,
        ay: nextMonth,
        displayAciklama: `${selectedMonth} ayından devir (Net Fark: ${fark >= 0 ? '+' : '-'}${Math.abs(fark).toLocaleString('tr-TR')} ₺)`
      } as any);

      toast.success(`${fark >= 0 ? '+' : ''}${fark.toLocaleString('tr-TR')} ₺ net fark → ${nextMonth} ayına ${transferType === 'gelir' ? 'gelir' : 'gider'} olarak devredildi.`);
      setSelectedMonth(nextMonth);
    }, 100);
  };

  const handleAddEntry = () => {
    if (!newEntry.aciklama || !newEntry.tutar || !newEntry.kategori) {
      toast.error("Lütfen tüm alanları doldurun.");
      return;
    }

    const tutar = parseFloat(newEntry.tutar);
    if (isNaN(tutar) || tutar <= 0) {
      toast.error("Geçerli bir tutar giriniz.");
      return;
    }

    // Aidat kategorisinde daire seçimi zorunlu
    if (entryType === 'gelir' && newEntry.kategori === 'Aidat Ödemesi') {
      if (!selectedDaireNo) {
        toast.error("Aidat ödemesi için lütfen daire seçiniz.");
        return;
      }
      const apt = apartments.find(a => a.daireNo === selectedDaireNo);
      if (!apt) {
        toast.error("Seçilen daire bulunamadı.");
        return;
      }
      // Mevcut ödemeyi kontrol et
      const existing = dues?.find(d => d.daireNo === selectedDaireNo);
      const existingPaid = existing?.odemeler?.[selectedMonth] || 0;
      const newTotal = existingPaid + tutar;

      // updateDuesPayment: hem aidat çizelgesine hem ledger'a (syncDuesPaymentToLedger içinde) yazar
      updateDuesPayment(selectedDaireNo, selectedMonth, newTotal);
      toast.success(`Daire ${selectedDaireNo} — ${selectedMonth} aidatı ${newTotal.toLocaleString('tr-TR')} ₺ olarak güncellendi.`);

      setIsAddDialogOpen(false);
      setNewEntry({ tarih: new Date().toLocaleDateString('tr-TR'), aciklama: '', tutar: '', kategori: '' });
      setSelectedDaireNo(null);
      return;
    }

    // Diğer kategoriler için normal ledger kaydı
    addLedgerEntry(selectedMonth, entryType, {
      tarih: newEntry.tarih,
      aciklama: newEntry.aciklama,
      tutar,
      kategori: newEntry.kategori,
      tip: entryType,
      ay: selectedMonth
    });

    setIsAddDialogOpen(false);
    setNewEntry({
      tarih: new Date().toLocaleDateString('tr-TR'),
      aciklama: '',
      tutar: '',
      kategori: ''
    });
    setSelectedDaireNo(null);
  };

  const handlePrintReceipt = (row: any, type: 'gelir' | 'gider') => {
    if (type === 'gider') {
      // Gider pusulası için önce "Kime" diyalogu aç
      setPendingReceiptRow(row);
      setKimeValue('');
      setKimeDialogOpen(true);
      return;
    }
    // Gelir makbuzu direkt yazdır
    _doPrintReceipt(row, type, '');
  };

  const _doPrintReceipt = (row: any, type: 'gelir' | 'gider', kime: string) => {
    printReceipt({
      type,
      amount: row.tutar,
      desc: row.aciklama,
      date: (() => {
        try {
          const parts = row.tarih.split('/');
          if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
          return new Date().toISOString();
        } catch { return new Date().toISOString(); }
      })(),
      name: type === 'gelir' ? row.aciklama : row.kategori,
      kime: kime || undefined,
      apartmentName: apartmentName || 'APARTMAN YÖNETİMİ'
    });
  };

  const handleKimeConfirm = () => {
    if (pendingReceiptRow) {
      _doPrintReceipt(pendingReceiptRow, 'gider', kimeValue);
    }
    setKimeDialogOpen(false);
    setPendingReceiptRow(null);
    setKimeValue('');
  };

  // İşletme defteri yazdırma - Gelir ve Gider yan yana (tek sayfa)
  const handlePrintLedger = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fmtCur = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const gelirRows = data.gelirler;
    const giderRows = data.giderler;

    // Önceki ay verilerini al (nakli yekün = önceki ayın devri)
    const currentIdx = MONTHS_TR.indexOf(selectedMonth);
    let nakliYekunGider = 0;
    let nakliYekunGelir = 0;
    if (currentIdx > 0) {
      const prevMonth = MONTHS_TR[currentIdx - 1];
      const prevData = ledger[prevMonth] || { giderler: [], gelirler: [] };
      nakliYekunGider = prevData.giderler.reduce((s: number, r: any) => s + r.tutar, 0);
      nakliYekunGelir = prevData.gelirler.reduce((s: number, r: any) => s + r.tutar, 0);
    }

    // Sonraki ay adı
    const nextMonthName = currentIdx < 11 ? MONTHS_TR[currentIdx + 1] : 'YENİ YIL';

    // Satır sayısını eşitle (en az 24 satır)
    const maxRows = Math.max(giderRows.length, gelirRows.length, 13);

    // Gider satırlarını oluştur
    const buildGiderRows = () => {
      let rows = '';
      for (let i = 0; i < maxRows; i++) {
        const r = giderRows[i];
        rows += `<tr>
          <td class="sira">${i + 1}</td>
          <td class="tarih">${r ? r.tarih : ''}</td>
          <td class="aciklama">${r ? r.aciklama : ''}</td>
          <td class="tutar">${r ? fmtCur(r.tutar) : ''}</td>
        </tr>`;
      }
      return rows;
    };

    // Gelir satırlarını oluştur
    const buildGelirRows = () => {
      let rows = '';
      for (let i = 0; i < maxRows; i++) {
        const r = gelirRows[i];
        // Daire no çıkar (açıklamadan)
        let daireNo = '';
        let adiSoyadi = '';
        if (r) {
          const match = String(r.aciklama).match(/\(D?:?(\d+)\)/);
          if (match) daireNo = match[1];
          else if (String(r.aciklama).match(/Daire\s*(\d+)/i)) {
            const m2 = String(r.aciklama).match(/Daire\s*(\d+)/i);
            if (m2) daireNo = m2[1];
          }
          adiSoyadi = r.aciklama;
        }
        rows += `<tr>
          <td class="sira">${i + 1}</td>
          <td class="tarih">${r ? r.tarih : ''}</td>
          <td class="aciklama">${adiSoyadi}</td>
          <td class="tutar">${r ? fmtCur(r.tutar) : ''}</td>
        </tr>`;
      }
      return rows;
    };

    const genelGelirGiderToplami = totalGelir - totalGider;
    const devirSonrakiAy = genelGelirGiderToplami;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <title>${apartmentName || 'Apartman'} - İşletme Defteri - ${selectedMonth} ${year}</title>
        <style>
          @page { size: A4 portrait; margin: 1.5cm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000; }

          .page { page-break-after: always; }
          .page:last-child { page-break-after: avoid; }

          .header-title {
            text-align: center; font-size: 15pt; font-weight: 800;
            text-transform: uppercase; padding: 10px; border: 2px solid #000;
            background: #fff; margin-bottom: 0;
          }
          .page-subtitle {
            text-align: center; font-size: 13pt; font-weight: 700;
            padding: 6px; border: 1px solid #000; border-top: none;
            margin-bottom: 0;
          }
          .page-subtitle.gider { background: #fee2e2; color: #991b1b; }
          .page-subtitle.gelir { background: #dcfce7; color: #166534; }

          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 5px 8px; font-size: 11pt; }
          th { background: #e8e8e8; font-weight: 700; text-align: center; font-size: 10pt; }

          .nakli-yekun td { background: #FFFF00 !important; font-weight: 800; text-align: center; font-size: 12pt; }
          .summary-row td { background: #FFFF00 !important; font-weight: 800; font-size: 11pt; }

          .sira { text-align: center; width: 40px; font-weight: 700; }
          .tarih { width: 90px; font-size: 10pt; }
          .tutar { text-align: right; width: 110px; font-family: 'Courier New', monospace; font-weight: 600; font-size: 11pt; }

          tr:nth-child(even) td { background: #fafafa; }
          .nakli-yekun td, .summary-row td { background: #FFFF00 !important; }

          .print-date { text-align: right; font-size: 8.5pt; color: #999; margin-top: 8px; }

          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        </style>
      </head>
      <body>

        <!-- SAYFA 1: GİDERLER -->
        <div class="page">
          <div class="header-title">${apartmentName || 'APARTMAN YÖNETİMİ'} — ${selectedMonth} ${year} İŞLETME DEFTERİ</div>
          <div class="page-subtitle gider">GİDER TABLOSU</div>
          <table>
            <thead>
              <tr>
                <th class="sira">SIRA<br>NO</th>
                <th class="tarih">TARİH</th>
                <th>AÇIKLAMA</th>
                <th style="width:110px">HARCAMA<br>BEDELİ</th>
              </tr>
            </thead>
            <tbody>
              <tr class="nakli-yekun">
                <td colspan="3">NAKLİ YEKÜN</td>
                <td class="tutar">${nakliYekunGider > 0 ? fmtCur(nakliYekunGider) : ''}</td>
              </tr>
              ${buildGiderRows()}
            </tbody>
            <tfoot>
              <tr class="summary-row">
                <td colspan="3" style="text-align:right; padding-right:12px;">TOPLAM GİDERLER</td>
                <td class="tutar">${fmtCur(totalGider + nakliYekunGider)}</td>
              </tr>
              <tr class="summary-row">
                <td colspan="2" style="text-align:right; padding-right:12px;">GENEL GELİR GİDER TOPLAMI</td>
                <td class="tutar">${fmtCur(totalGider + nakliYekunGider)}</td>
                <td class="tutar">${fmtCur(totalGelir + nakliYekunGelir)}</td>
              </tr>
            </tfoot>
          </table>
          <div class="print-date">Baskı: ${new Date().toLocaleString('tr-TR')}</div>
        </div>

        <!-- SAYFA 2: GELİRLER -->
        <div class="page">
          <div class="header-title">${apartmentName || 'APARTMAN YÖNETİMİ'} — ${selectedMonth} ${year} İŞLETME DEFTERİ</div>
          <div class="page-subtitle gelir">GELİR TABLOSU</div>
          <table>
            <thead>
              <tr>
                <th class="sira">DAİRE<br>NO</th>
                <th class="tarih">TARİH</th>
                <th>ADI SOYADI</th>
                <th style="width:110px">TUTAR</th>
              </tr>
            </thead>
            <tbody>
              <tr class="nakli-yekun">
                <td colspan="3">${selectedMonth} AYI NAKLİ YEKÜN</td>
                <td class="tutar">${nakliYekunGelir > 0 ? fmtCur(nakliYekunGelir) : ''}</td>
              </tr>
              ${buildGelirRows()}
            </tbody>
            <tfoot>
              <tr class="summary-row">
                <td colspan="3" style="text-align:right; padding-right:12px;">ARA TOPLAM</td>
                <td class="tutar">${fmtCur(totalGelir)}</td>
              </tr>
              <tr class="summary-row">
                <td colspan="3" style="text-align:right; padding-right:12px;">TOPLAM GELİRLER</td>
                <td class="tutar">${fmtCur(totalGelir + nakliYekunGelir)}</td>
              </tr>
              <tr class="summary-row">
                <td colspan="3" style="text-align:right; padding-right:12px;">${nextMonthName} AYINA DEVİR</td>
                <td class="tutar">${fmtCur(devirSonrakiAy)}</td>
              </tr>
            </tfoot>
          </table>
          <div class="print-date">Baskı: ${new Date().toLocaleString('tr-TR')}</div>
        </div>

        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">

        {/* Gider Pusulası - Kime Diyalogu */}
        <Dialog open={kimeDialogOpen} onOpenChange={setKimeDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-500" />
                Gider Pusulası — Kime?
              </DialogTitle>
              <DialogDescription>
                Ödeme yapılan kişi veya kurumun adını girin. Boş bırakırsanız pusulada boş kalır.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="kime-input" className="mb-2 block text-sm font-medium">Ödeyen / Kime</Label>
              <Input
                id="kime-input"
                value={kimeValue}
                onChange={e => setKimeValue(e.target.value)}
                placeholder="Örn: Ali Yılmaz, ABC Elektrik Ltd."
                onKeyDown={e => { if (e.key === 'Enter') handleKimeConfirm(); }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setKimeDialogOpen(false); setPendingReceiptRow(null); }}>İptal</Button>
              <Button onClick={handleKimeConfirm} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="w-4 h-4 mr-1" /> Yazdır
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-8 h-8 text-primary" />
              İşletme Defteri
            </h1>
            <p className="text-muted-foreground mt-1">
              {apartmentName || 'Apartman'} — {year} Yılı Aylık Gelir ve Gider Kayıtları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-slate-300 hover:bg-slate-50"
              onClick={handlePrintLedger}
            >
              <Printer className="w-4 h-4" />
              Defteri Yazdır
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
                  <Plus className="w-4 h-4" /> Yeni Kayıt Ekle
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Yeni İşletme Defteri Kaydı
                  </DialogTitle>
                  <DialogDescription>
                    {selectedMonth} ayı için yeni bir gelir veya gider kaydı ekleyin.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Tip</Label>
                    <Tabs value={entryType} onValueChange={(v) => setEntryType(v as 'gelir' | 'gider')} className="col-span-3">
                      <TabsList className="w-full">
                        <TabsTrigger value="gider" className="flex-1 data-[state=active]:bg-red-500 data-[state=active]:text-white">
                          <TrendingDown className="w-3 h-3 mr-1" /> Gider
                        </TabsTrigger>
                        <TabsTrigger value="gelir" className="flex-1 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                          <TrendingUp className="w-3 h-3 mr-1" /> Gelir
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">Tarih</Label>
                    <Input id="date" value={newEntry.tarih} onChange={e => setNewEntry({ ...newEntry, tarih: e.target.value })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Kategori</Label>
                    <Select value={newEntry.kategori} onValueChange={(v) => setNewEntry({ ...newEntry, kategori: v })}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Kategori Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(entryType === 'gider' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Aidat seçilince daire seçimi - aidat çizelgesine de yansıt */}
                  {entryType === 'gelir' && newEntry.kategori === 'Aidat Ödemesi' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right text-emerald-700 font-semibold">Daire</Label>
                      <div className="col-span-3">
                        <Select value={selectedDaireNo?.toString() || ''} onValueChange={(v) => {
                          const daireNo = parseInt(v);
                          setSelectedDaireNo(daireNo);
                          const apt = apartments.find(a => a.daireNo === daireNo);
                          if (apt) setNewEntry(prev => ({ ...prev, aciklama: `${apt.sakinAdi} (D:${daireNo}) - ${selectedMonth} Aidati` }));
                        }}>
                          <SelectTrigger className="border-emerald-300">
                            <SelectValue placeholder="Aidat ödeyen daireyi seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {apartments.filter(a => !a.isManager).map(apt => {
                              const duesRow = dues?.find(d => d.daireNo === apt.daireNo);
                              const paid = duesRow?.odemeler?.[selectedMonth] || 0;
                              return (
                                <SelectItem key={apt.daireNo} value={apt.daireNo.toString()}>
                                  D:{apt.daireNo} — {apt.sakinAdi}{paid > 0 ? ` ✓ (${paid.toLocaleString('tr-TR')} ₺)` : ' ⚠ ödenmemiş'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-emerald-600 mt-1">ℹ️ Aidat çizelgesine de otomatik yansır</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="desc" className="text-right">Açıklama</Label>
                    <div className="col-span-3 space-y-2">
                      <Input id="desc" value={newEntry.aciklama} onChange={e => setNewEntry({ ...newEntry, aciklama: e.target.value })} placeholder="Açıklama giriniz..." />
                      {entryType === 'gelir' && newEntry.kategori !== 'Aidat Ödemesi' && (
                        <Select onValueChange={(v) => setNewEntry({ ...newEntry, aciklama: v })}>
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue placeholder="Daire Seç (Şablon)" />
                          </SelectTrigger>
                          <SelectContent>
                            {apartments.map(apt => (
                              <SelectItem key={apt.daireNo} value={`${apt.sakinAdi} (${apt.daireNo})`}>
                                Daire {apt.daireNo} - {apt.sakinAdi}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">Tutar</Label>
                    <Input id="amount" type="number" value={newEntry.tutar} onChange={e => setNewEntry({ ...newEntry, tutar: e.target.value })} className="col-span-3" placeholder="0.00" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>İptal</Button>
                  <Button onClick={handleAddEntry} className={entryType === 'gelir' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}>
                    Kaydet
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex flex-wrap gap-2 p-1">
          {MONTHS.map((month) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${selectedMonth === month
                ? "bg-primary text-white shadow-md border-primary"
                : "bg-card text-muted-foreground hover:bg-muted border-border hover:scale-105"
                }`}
            >
              {month.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Summary Cards for selected month */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Gelir</CardTitle>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalGelir)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.gelirler.length} kayıt — {selectedMonth} {year}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Gider</CardTitle>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalGider)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.giderler.length} kayıt — {selectedMonth} {year}</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 hover:shadow-md transition-shadow ${fark >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
            <CardHeader className="pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Fark</CardTitle>
              <ArrowLeftRight className={`w-5 h-5 ${fark >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </CardHeader>
            <CardContent className="pt-1">
              <p className={`text-2xl font-bold ${fark >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {formatCurrency(fark)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                {fark >= 0 ? '✓ Olumlu bakiye' : '⚠ Gider fazlası'}
              </p>
              {MONTHS_TR.indexOf(selectedMonth) < 11 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
                  onClick={handleTransferToNextMonth}
                >
                  ↗ {MONTHS_TR[MONTHS_TR.indexOf(selectedMonth) + 1]} ayına devret
                </Button>
              )}
            </CardContent>
          </Card>
        </div>


        {/* Tabs for Gelir/Gider */}
        <Tabs defaultValue="gider" className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="gider" className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg transition-all">
              <TrendingDown className="w-4 h-4" />
              Giderler
              <span className="ml-1 text-xs bg-current/20 px-1.5 py-0.5 rounded-full opacity-80">{data.giderler.length}</span>
            </TabsTrigger>
            <TabsTrigger value="gelir" className="flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg transition-all">
              <TrendingUp className="w-4 h-4" />
              Gelirler
              <span className="ml-1 text-xs bg-current/20 px-1.5 py-0.5 rounded-full opacity-80">{data.gelirler.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* GİDERLER */}
          <TabsContent value="gider" className="mt-0">
            <Card className="overflow-hidden border-red-100 dark:border-red-900/40 shadow-sm">
              <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 px-4 py-2 border-b border-red-100 dark:border-red-900/40 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  {selectedMonth} {year} — Gider Kayıtları
                </span>
                <span className="text-xs text-red-600 dark:text-red-400 font-mono font-bold">{formatCurrency(totalGider)}</span>
              </div>
              <div className="overflow-x-auto">
                {/* A4 print uyumlu tablo */}
                <table className="w-full text-sm" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[50px] text-xs">#</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[90px] text-xs">Tarih</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 text-xs">Açıklama</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[130px] text-xs">Kategori</th>
                      <th className="h-10 px-3 text-right align-middle font-semibold text-slate-600 dark:text-slate-300 w-[110px] text-xs">Tutar</th>
                      <th className="h-10 px-2 w-[80px] text-center align-middle text-slate-500 dark:text-slate-400 text-xs">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.giderler.length === 0 && (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                          <div className="flex flex-col items-center gap-2 py-8">
                            <TrendingDown className="w-10 h-10 text-slate-300" />
                            Bu ay için gider kaydı bulunmuyor.
                          </div>
                        </td>
                      </tr>
                    )}
                    {data.giderler.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-red-50/50 dark:hover:bg-red-950/10 transition-colors group">
                        <td className="px-3 py-3 align-middle text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-3 py-3 align-middle font-medium text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.tarih}</td>
                        <td className="px-3 py-3 align-middle text-sm">{row.aciklama}</td>
                        <td className="px-3 py-3 align-middle">
                          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">
                            {row.kategori}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle text-right font-bold text-red-600 dark:text-red-400 text-sm tabular-nums">
                          {formatCurrency(row.tutar)}
                        </td>
                        <td className="px-2 py-3 align-middle text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Gider pusulası yazdır"
                              onClick={() => handlePrintReceipt(row, 'gider')}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => deleteLedgerEntry(selectedMonth, 'gider', row.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 dark:bg-red-950/20 font-bold border-t-2 border-red-200 dark:border-red-800">
                      <td colSpan={4} className="px-3 py-3 align-middle text-sm text-red-700 dark:text-red-300">
                        TOPLAM GİDER ({selectedMonth} {year})
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-red-700 dark:text-red-300 text-base tabular-nums">
                        {formatCurrency(totalGider)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* GELİRLER */}
          <TabsContent value="gelir" className="mt-0">
            <Card className="overflow-hidden border-emerald-100 dark:border-emerald-900/40 shadow-sm">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 px-4 py-2 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {selectedMonth} {year} — Gelir Kayıtları
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">{formatCurrency(totalGelir)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[50px] text-xs">#</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[90px] text-xs">Tarih</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 text-xs">Açıklama</th>
                      <th className="h-10 px-3 text-left align-middle font-semibold text-slate-600 dark:text-slate-300 w-[130px] text-xs">Kategori</th>
                      <th className="h-10 px-3 text-right align-middle font-semibold text-slate-600 dark:text-slate-300 w-[110px] text-xs">Tutar</th>
                      <th className="h-10 px-2 w-[80px] text-center align-middle text-slate-500 dark:text-slate-400 text-xs">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.gelirler.length === 0 && (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                          <div className="flex flex-col items-center gap-2 py-8">
                            <TrendingUp className="w-10 h-10 text-slate-300" />
                            Bu ay için gelir kaydı bulunmuyor.
                          </div>
                        </td>
                      </tr>
                    )}
                    {data.gelirler.map((row: any, idx) => {
                      const isAutoAidat = String(row.aciklama).startsWith('aidat_dues_');
                      const isDevir = String(row.aciklama).startsWith('devir_from_');
                      const isAutoEntry = isAutoAidat || isDevir;
                      const displayDesc = isAutoAidat
                        ? (row.displayAciklama || `${row.sakinAdi || ''} Aidat`)
                        : isDevir
                          ? (row.displayAciklama || `${String(row.aciklama).replace('devir_from_', '')} devri`)
                          : row.aciklama;
                      return (
                        <tr key={row.id} className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors group ${isAutoEntry ? 'bg-emerald-50/20' : ''}`}>
                          <td className="px-3 py-3 align-middle text-muted-foreground font-mono text-xs">{idx + 1}</td>
                          <td className="px-3 py-3 align-middle font-medium text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.tarih}</td>
                          <td className="px-3 py-3 align-middle text-sm">
                            {displayDesc}
                            {isAutoAidat && (
                              <span className="ml-2 text-[10px] font-semibold bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-full">AİDAT ÇİZELGESİ</span>
                            )}
                            {isDevir && (
                              <span className="ml-2 text-[10px] font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">DEVİR</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
                              {row.kategori}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                            {formatCurrency(row.tutar)}
                          </td>
                          <td className="px-2 py-3 align-middle text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title="Para makbuzu yazdır"
                                onClick={() => handlePrintReceipt({ ...row, aciklama: displayDesc }, 'gelir')}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => deleteLedgerEntry(selectedMonth, 'gelir', row.id)}
                                title="Sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 dark:bg-emerald-950/20 font-bold border-t-2 border-emerald-200 dark:border-emerald-800">
                      <td colSpan={4} className="px-3 py-3 align-middle text-sm text-emerald-700 dark:text-emerald-300">
                        TOPLAM GELİR ({selectedMonth} {year})
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-emerald-700 dark:text-emerald-300 text-base tabular-nums">
                        {formatCurrency(totalGelir)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default OperatingLedger;
