import { Layout } from "@/components/Layout";
import { MONTHS, formatNumber, formatCurrency, MONTHLY_DUES, ELEVATOR_FEE } from "@/data/initialData";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pencil, Save, Plus, Trash2, Download, Upload, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { exportToCSV } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DuesSchedule = () => {
  const {
    dues,
    apartments,
    duesColumns,
    duesColumnFees,
    updateDuesPayment,
    updateElevatorPayment,
    updateExtraFee,
    addDuesColumn,
    removeDuesColumn,
    updateDuesColumnFee,
    year,
    monthlyDuesAmount,
    currentMonthIndex,
    updateMonthlyDuesAmount,
    annualElevatorFee,
    updateAnnualElevatorFee,
    updateDevir,
    importDuesData,
    isLoading,
  } = useData();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">Aidat çizelgesi yükleniyor...</p>
        </div>
      </Layout>
    );
  }

  const [isEditing, setIsEditing] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnFee, setNewColumnFee] = useState<string>("");
  const [isAddColOpen, setIsAddColOpen] = useState(false);
  const [isDeleteColOpen, setIsDeleteColOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [isEditingDuesAmount, setIsEditingDuesAmount] = useState(false);
  const [isEditingElevator, setIsEditingElevator] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState("all");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local edit buffer: key = `${daireNo}_${month}`, value = string
  const [localEditValues, setLocalEditValues] = useState<Record<string, string>>({});

  const getLocalVal = (daireNo: number, month: string, fallback: number, blok?: string) => {
    const key = blok ? `${daireNo}_${blok}_${month}` : `${daireNo}_${month}`;
    return key in localEditValues ? localEditValues[key] : (fallback > 0 ? String(fallback) : '');
  };

  const handleDuesInputChange = (daireNo: number, month: string, val: string, blok?: string) => {
    const key = blok ? `${daireNo}_${blok}_${month}` : `${daireNo}_${month}`;
    setLocalEditValues(prev => ({ ...prev, [key]: val }));
  };

  const handleDuesInputCommit = (daireNo: number, month: string, blok?: string) => {
    const key = blok ? `${daireNo}_${blok}_${month}` : `${daireNo}_${month}`;
    if (key in localEditValues) {
      const parsed = parseFloat(localEditValues[key]) || 0;
      updateDuesPayment(daireNo, month, parsed, blok);
      setLocalEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const blocks = Array.from(new Set((apartments || []).map(a => a.blok).filter(Boolean))).sort();

  const filteredDues = selectedBlock === "all"
    ? (dues || [])
    : (dues || []).filter(d => d.blok === selectedBlock);
  const [tempDuesAmount, setTempDuesAmount] = useState(monthlyDuesAmount);
  const [showFutureMonths, setShowFutureMonths] = useState(false);
  const showLateFees = true;


  const toggleEdit = () => {
    if (isEditing) {
      toast.success("Düzenleme modu kapatıldı.");
    }
    setIsEditing(!isEditing);
  };

  const handleAddColumn = () => {
    if (newColumnName) {
      const fee = parseFloat(newColumnFee) || 0;
      addDuesColumn(newColumnName, fee > 0 ? fee : undefined);
      setNewColumnName("");
      setNewColumnFee("");
      setIsAddColOpen(false);
    }
  };

  const toggleColumn = (columnId: string) => {
    setHiddenColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const handleDownload = () => {
    const headers = ['Daire', 'Sakin', 'Devir', ...MONTHS, 'Asansör', ...duesColumns, 'Toplam Ödenen', 'Bakiye'];
    const rows = dues.map(d => [
      d.daireNo,
      d.sakinAdi,
      d.devredenBorc2024,
      ...MONTHS.map(m => d.odemeler[m] || 0),
      d.asansorOdemesi,
      ...duesColumns.map(c => d.extraFees?.[c] || 0),
      d.toplamOdenen,
      d.odenecekToplamBorc
    ]);

    import('@/lib/exportUtils').then(({ exportToExcel }) => {
      exportToExcel(`Aidat_Cizelgesi_${year}`, {
        title: `${year} Yılı Aidat Ödeme Çizelgesi`,
        subtitle: `Saffet Sabancı Apartmanı - Aylık Aidat: ${formatCurrency(monthlyDuesAmount)}`,
        headers,
        rows,
        highlightColumns: [rows[0].length - 1],
        redIfNegative: [rows[0].length - 1]
      });
      toast.success('Tablo Excel dosyası olarak indirildi');
    });
  };

  // Excel Import İşlemi
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const workbookRefObj = useRef<any>(null);
  const [isSheetSelectOpen, setIsSheetSelectOpen] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      workbookRefObj.current = workbook;

      if (workbook.SheetNames.length > 1) {
        setSheetNames(workbook.SheetNames);
        setIsSheetSelectOpen(true);
      } else {
        processSheet(workbook, workbook.SheetNames[0], XLSX);
      }
    } catch (err) {
      console.error('Excel parse error:', err);
      toast.error("Excel dosyası okunamadı. Lütfen geçerli bir .xlsx dosyası seçin.");
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processSheet = async (workbook: any, sheetName: string, xlsxModule?: any) => {
    try {
      const XLSX = xlsxModule || await import('xlsx');
      const ws = workbook.Sheets[sheetName];

      if (!ws) {
        toast.error(`"${sheetName}" sayfası bulunamadı.`);
        return;
      }

      const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log('[Excel Import] Sheet:', sheetName, 'Rows:', jsonData.length);

      if (jsonData.length < 2) {
        toast.error("Excel sayfasında yeterli veri bulunamadı.");
        return;
      }

      // Header satırını otomatik bul
      let headerRowIdx = -1;
      let headerRow: string[] = [];

      for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const rowStr = row.map((h: any) => String(h || '').trim().toUpperCase());
        const hasDaire = rowStr.some((h: string) =>
          h === 'DAİRE NO' || h === 'DAIRE NO' || h === 'DAİRE' || h === 'DAIRE' || h === 'NO'
        );
        const hasMonth = rowStr.some((h: string) =>
          h.startsWith('OCAK') || h.startsWith('ŞUB') || h.startsWith('MART')
        );
        if (hasDaire && hasMonth) {
          headerRowIdx = i;
          headerRow = rowStr;
          break;
        }
        if (hasDaire) {
          const hasName = rowStr.some((h: string) =>
            h.includes('ADI') || h.includes('SAKİN') || h.includes('SAKIN') || h.includes('SOYADI')
          );
          if (hasName) {
            headerRowIdx = i;
            headerRow = rowStr;
            break;
          }
        }
      }

      console.log('[Excel Import] Header row index:', headerRowIdx, 'Columns:', headerRow);

      if (headerRowIdx < 0) {
        toast.error(`"${sheetName}" sayfasında 'DAİRE NO' sütun başlığı bulunamadı.`);
        return;
      }

      // Sütun indekslerini bul
      const daireIdx = headerRow.findIndex((h: string) =>
        h === 'DAİRE NO' || h === 'DAIRE NO' || h === 'DAİRE' || h === 'DAIRE' || h === 'NO'
      );
      const sakinIdx = headerRow.findIndex((h: string) =>
        h.includes('ADI') || h.includes('SAKİN') || h.includes('SAKIN') || h === 'AD SOYAD'
      );
      // Devir: "DEVREDEN" özellikle ara, "BORÇ" tek başına yakalanmasın
      const devirIdx = headerRow.findIndex((h: string) =>
        h.includes('DEVİR') || h.includes('DEVIR') || h.includes('DEVREDEN')
      );
      // Asansör: son sütunlarda ara (TOPLAM ÖDENEN sonrası)
      const toplamIdx = headerRow.findIndex((h: string) => h.includes('TOPLAM'));
      const asansorIdx = headerRow.findIndex((h: string, idx: number) =>
        (h.includes('ASANSÖR') || h.includes('ASANSOR')) && (toplamIdx < 0 || idx > toplamIdx)
      );
      // Asansör bulunamadıysa herhangi birini al
      const finalAsansorIdx = asansorIdx >= 0 ? asansorIdx : headerRow.findIndex((h: string) =>
        h.includes('ASANSÖR') || h.includes('ASANSOR')
      );

      const diyafonIdx = headerRow.findIndex((h: string) =>
        h.includes('DİYAFON') || h.includes('DIYAFON') || h.includes('GÖRÜNTÜ')
      );

      // Ay sütunlarını bul
      const monthMap: Record<string, string[]> = {
        'OCAK': ['OCAK'],
        'ŞUBAT': ['ŞUBAT', 'SUBAT', 'ŞUB'],
        'MART': ['MART'],
        'NİSAN': ['NİSAN', 'NISAN', 'NİS'],
        'MAYIS': ['MAYIS', 'MAY'],
        'HAZİRAN': ['HAZİRAN', 'HAZIRAN', 'HAZ'],
        'TEMMUZ': ['TEMMUZ', 'TEM'],
        'AĞUSTOS': ['AĞUSTOS', 'AGUSTOS', 'AĞU'],
        'EYLÜL': ['EYLÜL', 'EYLUL', 'EYL'],
        'EKİM': ['EKİM', 'EKIM'],
        'KASIM': ['KASIM', 'KAS'],
        'ARALIK': ['ARALIK', 'ARA']
      };

      const monthIndices: Record<string, number> = {};
      MONTHS.forEach(month => {
        const aliases = monthMap[month] || [month];
        const idx = headerRow.findIndex((h: string) => {
          const trimmed = h.trim();
          return aliases.some(alias => trimmed === alias || trimmed.startsWith(alias + ' '));
        });
        if (idx >= 0) monthIndices[month] = idx;
      });

      const extraColumnIndices: Record<string, number> = {};
      duesColumns.forEach(col => {
        const idx = headerRow.findIndex((h: string) =>
          h.trim() === col.toUpperCase() || h.includes(col.toUpperCase())
        );
        if (idx >= 0) extraColumnIndices[col] = idx;
      });

      if (diyafonIdx >= 0 && !duesColumns.some(c => c.toUpperCase().includes('DİYAFON'))) {
        extraColumnIndices['Görüntülü Diyafon'] = diyafonIdx;
      }

      console.log('[Excel Import] Columns found - Daire:', daireIdx, 'Sakin:', sakinIdx, 'Devir:', devirIdx, 'Asansör:', finalAsansorIdx, 'Months:', monthIndices);

      if (daireIdx < 0) {
        toast.error("Excel dosyasında 'Daire' sütunu bulunamadı.");
        return;
      }

      // Verileri parse et
      const parsedData: any[] = [];
      for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row[daireIdx] === null || row[daireIdx] === undefined) continue;

        const daireNo = parseInt(String(row[daireIdx]));
        if (isNaN(daireNo) || daireNo <= 0) continue;

        const entry: any = { daireNo };

        if (sakinIdx >= 0 && row[sakinIdx]) {
          entry.sakinAdi = String(row[sakinIdx]).trim();
        }
        if (devirIdx >= 0 && row[devirIdx] !== undefined && row[devirIdx] !== null && row[devirIdx] !== '') {
          entry.devir = parseFloat(String(row[devirIdx]).replace(',', '.')) || 0;
        }
        if (finalAsansorIdx >= 0 && row[finalAsansorIdx] !== undefined && row[finalAsansorIdx] !== null && row[finalAsansorIdx] !== '') {
          entry.asansor = parseFloat(String(row[finalAsansorIdx]).replace(',', '.')) || 0;
        }

        const odemeler: Record<string, number> = {};
        Object.entries(monthIndices).forEach(([month, idx]) => {
          if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
            const val = parseFloat(String(row[idx]).replace(',', '.')) || 0;
            if (val > 0) odemeler[month] = val;
          }
        });
        if (Object.keys(odemeler).length > 0) entry.odemeler = odemeler;

        const extraFees: Record<string, number> = {};
        Object.entries(extraColumnIndices).forEach(([col, idx]) => {
          if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
            const val = parseFloat(String(row[idx]).replace(',', '.')) || 0;
            if (val > 0) extraFees[col] = val;
          }
        });
        if (Object.keys(extraFees).length > 0) entry.extraFees = extraFees;

        parsedData.push(entry);
      }

      console.log('[Excel Import] Parsed data count:', parsedData.length, parsedData.slice(0, 3));

      if (parsedData.length === 0) {
        toast.error("Excel'den okunabilir veri bulunamadı.");
        return;
      }

      setImportPreview(parsedData);
      setIsImportOpen(true);
      setIsSheetSelectOpen(false);
      toast.info(`${parsedData.length} daire verisi okundu. Onaylamak için "İçe Aktar" butonuna basın.`);
    } catch (err: any) {
      console.error('[Excel Import] Error:', err);
      toast.error(`Excel işlenirken hata: ${err?.message || 'Bilinmeyen hata'}`);
    }
  };

  const confirmImport = () => {
    if (importPreview && importPreview.length > 0) {
      importDuesData(importPreview);
      setImportPreview(null);
      setIsImportOpen(false);
    }
  };

  // Bakiye hesaplama (Sadece anapara borcu)
  const calculateBalance = (row: any, isManager: boolean, subjectToElevator: boolean) => {
    const devir = row.devredenBorc2024 || 0;

    let totalDue = 0;
    MONTHS.forEach((m, idx) => {
      if (!isManager && idx <= currentMonthIndex) {
        totalDue += monthlyDuesAmount;
      }
    });

    if (subjectToElevator) {
      totalDue += annualElevatorFee;
    }

    // Extra sütun ücretlerini ekle
    duesColumns.forEach(col => {
      const colFee = duesColumnFees[col] || 0;
      if (colFee > 0 && !isManager) {
        totalDue += colFee;
      }
    });

    // NOT: Gecikme cezası ayrı bir sütun olduğu için burada eklemiyoruz.
    // Böylece Borç sütunu anaparayı gösterir, Toplam sütununda ceza ile toplanır.

    const totalPaid = row.toplamOdenen || 0;

    return devir + totalDue - totalPaid;
  };

  const calculateLateFee = (row: any, isManager: boolean) => {
    if (isManager) return 0;
    let penalty = 0;
    MONTHS.forEach((m, idx) => {
      if (idx < currentMonthIndex) {
        const paid = row.odemeler[m] || 0;
        const due = monthlyDuesAmount;
        const diff = due - paid;
        if (diff > 0) {
          penalty += diff * 0.05;
        }
      }
    });
    return penalty;
  };

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Aidat Ödeme Çizelgesi</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">{year} Yılı</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              Aylık Aidat:
              {isEditingDuesAmount ? (
                <Input
                  type="number"
                  value={tempDuesAmount}
                  onChange={(e) => setTempDuesAmount(parseFloat(e.target.value) || 0)}
                  className="w-32 h-7 text-sm"
                  onBlur={() => {
                    setIsEditingDuesAmount(false);
                    updateMonthlyDuesAmount(tempDuesAmount);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingDuesAmount(false);
                      updateMonthlyDuesAmount(tempDuesAmount);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="font-medium text-primary cursor-pointer hover:underline"
                  onClick={() => {
                    setTempDuesAmount(monthlyDuesAmount);
                    setIsEditingDuesAmount(true);
                  }}
                  title="Düzenlemek için tıklayın"
                >
                  {formatCurrency(monthlyDuesAmount)}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col bg-card p-2 rounded-lg border border-border shadow-sm items-end min-w-[150px]" style={{ textAlign: 'center' }}>
            <span className="text-xs text-muted-foreground mb-1 font-medium">Yıllık Asansör</span>
            <p className="text-xl font-bold text-purple-600 flex items-center">
              <span className="text-sm mr-1">₺</span>
              {isEditingElevator ? (
                <Input
                  type="number"
                  value={annualElevatorFee}
                  onChange={(e) => updateAnnualElevatorFee(parseFloat(e.target.value) || 0)}
                  className="w-24 h-7 text-sm text-right"
                  onBlur={() => setIsEditingElevator(false)}
                  autoFocus
                />
              ) : (
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => setIsEditingElevator(true)}
                  title="Düzenlemek için tıklayın"
                >
                  {formatNumber(annualElevatorFee)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-2 rounded-xl border w-full lg:w-auto">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors mr-2 bg-background/70 dark:bg-muted/40 px-2 py-1 rounded-lg border border-border">
              <input
                type="checkbox"
                checked={showFutureMonths}
                onChange={(e) => setShowFutureMonths(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              Gelecek Aylar
            </label>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setIsAddColOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Ekle
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsDeleteColOpen(true)} disabled={duesColumns.length === 0}>
                <Trash2 className="w-4 h-4 mr-1" /> Sil
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="w-4 h-4 mr-1" /> Görünüm
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] h-[300px] overflow-y-auto">
                <DropdownMenuLabel>Sütunları Göster/Gizle</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('no')}
                  onCheckedChange={() => toggleColumn('no')}
                  onSelect={(e) => e.preventDefault()}
                >
                  No
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('sakin')}
                  onCheckedChange={() => toggleColumn('sakin')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Sakin
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('devir')}
                  onCheckedChange={() => toggleColumn('devir')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Devir
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {MONTHS.map(month => (
                  <DropdownMenuCheckboxItem
                    key={month}
                    checked={!hiddenColumns.includes(month)}
                    onCheckedChange={() => toggleColumn(month)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {month}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('asansor')}
                  onCheckedChange={() => toggleColumn('asansor')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Asansör
                </DropdownMenuCheckboxItem>
                {duesColumns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={!hiddenColumns.includes(col)}
                    onCheckedChange={() => toggleColumn(col)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('yilToplam')}
                  onCheckedChange={() => toggleColumn('yilToplam')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Yıllık Tahakkuk
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('toplamOdenen')}
                  onCheckedChange={() => toggleColumn('toplamOdenen')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Toplam Ödenen
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('borc')}
                  onCheckedChange={() => toggleColumn('borc')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Borç
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('gecikmeCezasi')}
                  onCheckedChange={() => toggleColumn('gecikmeCezasi')}
                  onSelect={(e) => e.preventDefault()}
                >
                  %5 Gecikme Cezası
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('odenecekToplam')}
                  onCheckedChange={() => toggleColumn('odenecekToplam')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Ödenecekler Toplam
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" /> İndir
            </Button>

            {/* Excel Import Butonu */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-900/40 dark:border-green-800 dark:text-green-300">
                <Upload className="w-4 h-4 mr-1" /> İçe Aktar
              </Button>
            </div>

            <div className="h-6 w-px bg-border mx-1"></div>

            <Button
              onClick={toggleEdit}
              variant={isEditing ? "default" : "secondary"}
              size="sm"
              className="gap-2 font-medium"
            >
              {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {isEditing ? "Bitti" : "Düzenle"}
            </Button>
          </div>
        </div>

        {blocks.length > 0 && (
          <Tabs value={selectedBlock} onValueChange={setSelectedBlock} className="w-full mb-4">
            <TabsList>
              <TabsTrigger value="all">Tümü</TabsTrigger>
              {blocks.map(b => (
                <TabsTrigger key={b} value={b!}>{b} Blok</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Add Column Dialog - Ücret alanı eklendi */}
        <Dialog open={isAddColOpen} onOpenChange={setIsAddColOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Ödeme Sütunu Ekle</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label>Sütun Başlığı (Örn: Yakıt Farkı)</Label>
                <Input value={newColumnName} onChange={e => setNewColumnName(e.target.value)} placeholder="Başlık giriniz..." />
              </div>
              <div>
                <Label>Ücret (TL) — <span className="text-muted-foreground text-xs">Her daire için beklenen toplam ücret</span></Label>
                <Input
                  type="number"
                  value={newColumnFee}
                  onChange={e => setNewColumnFee(e.target.value)}
                  placeholder="Örn: 500"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddColOpen(false)}>İptal</Button>
              <Button onClick={handleAddColumn}>Ekle</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Column Dialog */}
        <Dialog open={isDeleteColOpen} onOpenChange={setIsDeleteColOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sütun Sil</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>Silinecek Sütunu Seçin</Label>
              {duesColumns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Silinebilecek özel sütun bulunmuyor.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(duesColumns || []).map(col => (
                    <div key={col} className="flex items-center justify-between p-2 rounded border bg-card">
                      <div>
                        <span className="font-medium">{col}</span>
                        {duesColumnFees[col] > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">(Ücret: {formatNumber(duesColumnFees[col])} TL)</span>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDuesColumn(col)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteColOpen(false)}>Kapat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet Select - Simple Modal (Radix Dialog sorun çıkarıyordu) */}
        {isSheetSelectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsSheetSelectOpen(false)}>
            <div className="fixed inset-0 bg-black/50" />
            <div
              className="relative z-50 bg-card text-card-foreground rounded-lg shadow-xl p-5 w-[340px] max-h-[400px] border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold mb-1">Sayfa Seçin</h3>
              <p className="text-xs text-muted-foreground mb-3">İçe aktarılacak sayfayı seçin:</p>
              <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto">
                {sheetNames.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-background text-left text-sm font-medium hover:bg-blue-50 hover:border-blue-400 active:bg-blue-100 dark:hover:bg-blue-900/30 dark:hover:border-blue-700 dark:active:bg-blue-900/40 transition-colors cursor-pointer"
                    onClick={() => {
                      const wb = workbookRefObj.current;
                      if (wb) {
                        setIsSheetSelectOpen(false);
                        processSheet(wb, name);
                      }
                    }}
                  >
                    📄 {name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors"
                  onClick={() => setIsSheetSelectOpen(false)}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Preview Dialog */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">İçe Aktarma Önizleme</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-3">
                {importPreview?.length || 0} daire verisi bulundu.
              </p>
              <div className="overflow-x-auto rounded border max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-100 dark:bg-slate-800">
                      <TableHead className="text-[10px] font-bold py-1 px-2">No</TableHead>
                      <TableHead className="text-[10px] font-bold py-1 px-2">Sakin</TableHead>
                      <TableHead className="text-[10px] font-bold py-1 px-2">Devir</TableHead>
                      <TableHead className="text-[10px] font-bold py-1 px-2">Ödemeler</TableHead>
                      <TableHead className="text-[10px] font-bold py-1 px-2">Asn.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview?.map((item, idx) => {
                      const matchedDaire = dues.find(d => d.daireNo === item.daireNo && d.blok === item.blok);
                      return (
                        <TableRow key={idx} className={matchedDaire ? '' : 'bg-yellow-50 dark:bg-yellow-900/20'}>
                          <TableCell className="text-[10px] font-bold py-1 px-2">{item.daireNo}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 max-w-[100px] truncate">{item.sakinAdi || '-'}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2">{item.devir !== undefined ? formatNumber(item.devir) : '-'}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 max-w-[150px] truncate">
                            {item.odemeler ? Object.entries(item.odemeler).map(([m, v]) => `${(m as string).slice(0, 3)}:${v}`).join(' ') : '-'}
                          </TableCell>
                          <TableCell className="text-[10px] py-1 px-2">{item.asansor !== undefined ? formatNumber(item.asansor) : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {importPreview && importPreview.some(p => !dues.some(d => d.daireNo === p.daireNo && d.blok === p.blok)) && (
                <p className="text-[10px] text-amber-700 mt-2">
                  ⚠ Sarı satırlar sistemde olmayan daireler — import edilmeyecek.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setImportPreview(null); setIsImportOpen(false); }}>İptal</Button>
              <Button size="sm" onClick={confirmImport} className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600">
                İçe Aktar ({importPreview?.filter(p => dues.some(d => d.daireNo === p.daireNo && d.blok === p.blok)).length || 0} daire)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <div className="overflow-x-auto">
            {/* Mobilde sağa kaydırma ipucu */}
            <div className="lg:hidden flex items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground animate-pulse border-b bg-slate-50 dark:bg-slate-900">
              <ArrowLeftRight className="w-3 h-3" />
              Sağa kaydırarak diğer ayları görebilirsiniz
            </div>
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-gray-800 hover:bg-gray-800 border-b-2 border-gray-700">
                  {!hiddenColumns.includes('no') && <TableHead className="sticky left-0 bg-gray-800 z-30 w-[40px] text-center font-bold text-white shadow-[1px_0_0_0_rgba(255,255,255,0.1)] text-[10px] md:text-xs tracking-wider">NO</TableHead>}
                  {!hiddenColumns.includes('sakin') && <TableHead className="sticky left-[40px] md:left-[50px] bg-gray-800 z-30 min-w-[120px] md:min-w-[150px] font-bold text-white shadow-[1px_0_0_0_rgba(255,255,255,0.1)] text-[10px] md:text-xs tracking-wider">DAİRE SAKİNİ</TableHead>}
                  {!hiddenColumns.includes('devir') && <TableHead className="text-center font-bold min-w-[70px] bg-amber-700 text-amber-100 text-[10px] md:text-xs tracking-wider">DEVİR</TableHead>}
                  {MONTHS.map((month, idx) => {
                    if (!showFutureMonths && idx > currentMonthIndex) return null;
                    if (hiddenColumns.includes(month)) return null;
                    return (
                      <TableHead key={month} className="text-center min-w-[65px] md:min-w-[75px] font-bold text-[10px] md:text-xs text-gray-200 uppercase bg-gray-700 tracking-wider">
                        {month.slice(0, 3)}
                      </TableHead>
                    );
                  })}
                  {!hiddenColumns.includes('asansor') && <TableHead className="text-center font-bold bg-indigo-700 text-indigo-100 text-[10px] md:text-xs tracking-wider whitespace-nowrap">ASANSÖR</TableHead>}
                  {(duesColumns || []).map(col => !hiddenColumns.includes(col) && (
                    <TableHead key={col} className="text-center font-bold bg-sky-700 text-sky-100 text-[10px] md:text-xs">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          {col}
                          {isEditing && <Trash2 className="w-3 h-3 cursor-pointer text-red-300 hover:text-red-100" onClick={() => removeDuesColumn(col)} />}
                        </div>
                        {duesColumnFees[col] > 0 && (
                          <span className="text-[8px] md:text-[9px] text-sky-200 font-normal">({formatNumber(duesColumnFees[col])} TL)</span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  {!hiddenColumns.includes('yilToplam') && <TableHead className="text-center font-bold bg-gray-700 text-gray-200 text-[10px] md:text-xs tracking-wider whitespace-nowrap">YILLIK<br />TOPLAM</TableHead>}
                  {!hiddenColumns.includes('toplamOdenen') && <TableHead className="text-right font-bold bg-emerald-700 text-emerald-100 text-[10px] md:text-xs tracking-wider whitespace-nowrap">TOPLAM<br />ÖDENEN</TableHead>}
                  {!hiddenColumns.includes('borc') && <TableHead className="text-right font-bold bg-orange-700 text-orange-100 text-[10px] md:text-xs tracking-wider">BORÇ</TableHead>}
                  {!hiddenColumns.includes('gecikmeCezasi') && <TableHead className="text-right font-bold bg-red-700 text-red-100 text-[10px] md:text-xs tracking-wider whitespace-nowrap">%5 GECİKME<br />CEZASI</TableHead>}
                  {!hiddenColumns.includes('odenecekToplam') && <TableHead className="text-right font-bold bg-slate-900 text-white text-[10px] md:text-xs tracking-wider sticky right-0 z-30 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.3)] whitespace-nowrap">ÖDENECEKLER<br />TOPLAM</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDues.map((row) => {
                  const apartment = apartments.find(apt => apt.daireNo === row.daireNo && apt.blok === row.blok);
                  const isManager = apartment?.isManager || false;
                  const subjectToElevator = apartment?.asansorTabi || false;

                  // Sütun ücretlerini yıllık toplama ekle
                  const extraColumnTotal = duesColumns.reduce((sum, col) => sum + (duesColumnFees[col] || 0), 0);
                  const annualExpected = (isManager ? 0 : 12 * monthlyDuesAmount) + (subjectToElevator ? annualElevatorFee : 0) + (isManager ? 0 : extraColumnTotal);

                  const lateFee = calculateLateFee(row, isManager);
                  const displayBalance = calculateBalance(row, isManager, subjectToElevator);
                  const isDebt = displayBalance > 0;

                  return (
                    <TableRow
                      key={`${row.blok || ''}-${row.daireNo}`}
                      className={`transition-colors group border-b border-slate-100 ${isManager
                        ? 'bg-purple-50/50 hover:bg-purple-100/50 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 opacity-60 cursor-not-allowed'
                        : 'hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                        }`}
                    >
                      {!hiddenColumns.includes('no') && <TableCell className={`sticky left-0 ${isManager ? 'bg-purple-50/50 group-hover:bg-purple-100/50 dark:bg-purple-950/20 dark:group-hover:bg-purple-900/30' : 'bg-white dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20'} z-20 font-bold text-center border-r shadow-[1px_0_0_0_hsl(var(--border))] text-slate-700 dark:text-slate-200 text-[10px] md:text-sm`}>
                        {row.daireNo}
                        {isManager && (
                          <span className="ml-1 text-[8px] md:text-[10px] text-purple-600">👤</span>
                        )}
                      </TableCell>}
                      {!hiddenColumns.includes('sakin') && <TableCell className={`sticky left-[40px] md:left-[50px] ${isManager ? 'bg-purple-50/50 group-hover:bg-purple-100/50 dark:bg-purple-950/20 dark:group-hover:bg-purple-900/30' : 'bg-white dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20'} z-20 font-medium text-[10px] md:text-xs whitespace-nowrap border-r shadow-[1px_0_0_0_hsl(var(--border))] text-slate-900 dark:text-slate-100`}>
                        {row.sakinAdi}
                      </TableCell>}

                      {/* DEVİR - Düzenlenebilir */}
                      {!hiddenColumns.includes('devir') && <TableCell className={`text-center text-xs font-medium border-r bg-orange-50/30 dark:bg-orange-950/20 ${row.devredenBorc2024 < 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                        {isEditing ? (
                            <Input
                              type="number"
                              value={getLocalVal(row.daireNo, '_devir', row.devredenBorc2024, row.blok)}
                              onChange={(e) => handleDuesInputChange(row.daireNo, '_devir', e.target.value, row.blok)}
                              onBlur={() => {
                                const key = row.blok ? `${row.daireNo}_${row.blok}__devir` : `${row.daireNo}__devir`;
                                if (key in localEditValues) {
                                  const parsed = parseFloat(localEditValues[key]) || 0;
                                  updateDevir(row.daireNo, parsed, row.blok);
                                  setLocalEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
                                }
                              }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                            className="h-8 w-20 text-right text-xs px-1 mx-auto"
                          />
                        ) : (
                          formatNumber(row.devredenBorc2024)
                        )}
                      </TableCell>}

                      {MONTHS.map((month, idx) => {
                        if (!showFutureMonths && idx > currentMonthIndex) return null;
                        if (hiddenColumns.includes(month)) return null;

                        const val = row.odemeler[month] || 0;
                        const isPastMonth = idx < currentMonthIndex;
                        const isFullPaid = val >= monthlyDuesAmount;
                        const isUnpaid = !isManager && val < monthlyDuesAmount;

                        let bgClass = "";
                        let cellClass = "";

                        if (isFullPaid) {
                          bgClass = "bg-emerald-200 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-300 font-bold shadow-sm";
                        } else if (isUnpaid && isPastMonth) {
                          bgClass = "bg-red-500 dark:bg-red-700 text-white font-extrabold shadow-lg";
                          cellClass = "bg-red-100 dark:bg-red-950/30 ring-2 ring-red-500 dark:ring-red-700";
                        } else if (isManager) {
                          bgClass = "text-purple-500 dark:text-purple-300 font-bold";
                        }

                        return (
                          <TableCell
                            key={month}
                            className={`p-1 text-center border-r border-slate-100 dark:border-slate-800 relative ${cellClass} ${isEditing ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                  <Input
                                    type="number"
                                    value={getLocalVal(row.daireNo, month, row.odemeler[month] || 0, row.blok)}
                                    onChange={(e) => handleDuesInputChange(row.daireNo, month, e.target.value, row.blok)}
                                    onBlur={() => handleDuesInputCommit(row.daireNo, month, row.blok)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                                    className={`h-8 w-full min-w-[50px] text-right text-xs px-1 ${val > 0 ? 'bg-background font-semibold' : 'bg-background/50'}`}
                                    placeholder="0"
                                    disabled={isManager}
                                  />
                                  {!isFullPaid && !isManager && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] px-1 bg-green-50 hover:bg-green-100 border-green-300 text-green-700 dark:bg-green-950/30 dark:hover:bg-green-900/40 dark:border-green-800 dark:text-green-300"
                                      onClick={() => updateDuesPayment(row.daireNo, month, monthlyDuesAmount, row.blok)}
                                    >
                                      ✓ Ödendi
                                    </Button>
                                  )}
                              </div>
                            ) : (
                              <div className={`py-1 rounded text-xs font-medium ${bgClass}`}>
                                {isManager ? (
                                  <span className="text-purple-400 select-none cursor-default font-extrabold text-lg mix-blend-multiply">-</span>
                                ) : (
                                  val > 0 ? formatNumber(val) : (isPastMonth ? "—" : "")
                                )}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Elevator */}
                      {!hiddenColumns.includes('asansor') && <TableCell className="text-center p-1 border-r border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20">
                        {isEditing ? (
                          apartment?.asansorTabi ? (
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                value={row.asansorOdemesi || ''}
                                onChange={(e) => updateElevatorPayment(row.daireNo, parseFloat(e.target.value) || 0, row.blok)}
                                className="h-8 w-16 text-right text-xs px-1 mx-auto"
                              />
                              {(row.asansorOdemesi || 0) < annualElevatorFee && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-1 bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300"
                                  onClick={() => updateElevatorPayment(row.daireNo, annualElevatorFee, row.blok)}
                                >
                                  ✓ Öde
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )
                        ) : (
                          apartment?.asansorTabi ? (
                            (row.asansorOdemesi || 0) >= annualElevatorFee ? (
                              <span className="text-xs font-bold text-emerald-600">
                                {formatNumber(row.asansorOdemesi)}
                              </span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-red-500">{formatNumber(row.asansorOdemesi)}</span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 line-through decoration-red-300 dark:decoration-red-700">
                                  Of {formatNumber(annualElevatorFee)}
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">-</span>
                          )
                        )}
                      </TableCell>}

                      {/* Extra Columns */}
                      {(duesColumns || []).map(col => !hiddenColumns.includes(col) && (
                        <TableCell key={col} className="text-center p-1 border-r border-sky-100 dark:border-sky-900/50 bg-sky-50/30 dark:bg-sky-950/20">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                value={row.extraFees?.[col] || ''}
                                onChange={(e) => updateExtraFee(row.daireNo, col, parseFloat(e.target.value) || 0, row.blok)}
                                className="h-8 w-16 text-right text-xs px-1 mx-auto"
                              />
                              {duesColumnFees[col] > 0 && (row.extraFees?.[col] || 0) < duesColumnFees[col] && !isManager && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-1 bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 dark:border-sky-800 dark:text-sky-300"
                                  onClick={() => updateExtraFee(row.daireNo, col, duesColumnFees[col], row.blok)}
                                >
                                  ✓ Öde
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs font-medium ${duesColumnFees[col] > 0 && (row.extraFees?.[col] || 0) >= duesColumnFees[col]
                              ? 'text-emerald-600 font-bold'
                              : 'text-sky-700'
                              }`}>{formatNumber(row.extraFees?.[col] || 0)}</span>
                          )}
                        </TableCell>
                      ))}

                      {/* Annual Total */}
                      {!hiddenColumns.includes('yilToplam') && <TableCell className="text-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800">
                        {formatNumber(annualExpected)}
                      </TableCell>}

                      {/* Total Paid */}
                      {!hiddenColumns.includes('toplamOdenen') && <TableCell className="text-right text-xs font-bold bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-r border-emerald-100 dark:border-emerald-900/50">
                        {formatNumber(row.toplamOdenen)}
                      </TableCell>}

                      {/* Balance (BORÇ) */}
                      {!hiddenColumns.includes('borc') && <TableCell className={`text-right bg-white dark:bg-slate-900 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/20 border-l shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] text-[10px] md:text-xs`}>
                        <span className={`font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded ${isDebt ? "text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/30" : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"}`}>
                          {formatNumber(displayBalance)}
                        </span>
                      </TableCell>}

                      {/* GECİKME CEZASI */}
                      {!hiddenColumns.includes('gecikmeCezasi') && (
                        <TableCell className="text-right text-[10px] md:text-xs text-destructive font-medium bg-red-50/50 dark:bg-red-950/20">
                          {lateFee > 0 ? formatNumber(lateFee) : "—"}
                        </TableCell>
                      )}

                      {/* ÖDENECEKLER TOPLAM */}
                      {!hiddenColumns.includes('odenecekToplam') && <TableCell className={`text-right sticky right-0 bg-slate-50 dark:bg-slate-900 group-hover:bg-blue-100/50 dark:group-hover:bg-blue-950/30 border-l z-20 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]`}>
                        <span className={`text-[10px] md:text-xs font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded ${displayBalance + lateFee > 0 ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/30" : "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/30"}`}>
                          {formatNumber(displayBalance + lateFee)}
                        </span>
                      </TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-gray-800 border-t-2 border-gray-600 text-white font-bold text-xs hover:bg-gray-800">
                  {!hiddenColumns.includes('no') && <TableCell colSpan={1} />}
                  {!hiddenColumns.includes('sakin') && <TableCell colSpan={1} className="font-extrabold tracking-widest text-gray-100">TOPLAM</TableCell>}
                  {!hiddenColumns.includes('devir') && <TableCell className="text-center text-amber-200">{formatNumber(dues.reduce((s, r) => s + r.devredenBorc2024, 0))}</TableCell>}
                  {MONTHS.map(m => !hiddenColumns.includes(m) && (
                    <TableCell key={m} className="text-center text-gray-200">{formatNumber(dues.reduce((s, r) => s + (r.odemeler[m] || 0), 0))}</TableCell>
                  ))}
                  {!hiddenColumns.includes('asansor') && <TableCell className="text-center text-indigo-200">{formatNumber(dues.reduce((s, r) => s + r.asansorOdemesi, 0))}</TableCell>}
                  {duesColumns.map(c => !hiddenColumns.includes(c) && (
                    <TableCell key={c} className="text-center text-sky-200">{formatNumber(dues.reduce((s, r) => s + (r.extraFees?.[c] || 0), 0))}</TableCell>
                  ))}
                  {!hiddenColumns.includes('yilToplam') && <TableCell />}
                  {!hiddenColumns.includes('toplamOdenen') && <TableCell className="text-right text-emerald-300">{formatNumber(dues.reduce((s, r) => s + r.toplamOdenen, 0))}</TableCell>}
                  {!hiddenColumns.includes('borc') && <TableCell className="text-right text-amber-300 font-bold tracking-tight">{formatNumber(dues.reduce((s, r) => s + Math.max(0, calculateBalance(r, apartments.find(a => a.daireNo === r.daireNo && a.blok === r.blok)?.isManager || false, apartments.find(a => a.daireNo === r.daireNo && a.blok === r.blok)?.asansorTabi || false)), 0))}</TableCell>}
                  {!hiddenColumns.includes('gecikmeCezasi') && <TableCell className="text-right text-red-300 font-bold">{formatNumber(dues.reduce((s, r) => s + calculateLateFee(r, apartments.find(a => a.daireNo === r.daireNo && a.blok === r.blok)?.isManager || false), 0))}</TableCell>}
                  {!hiddenColumns.includes('odenecekToplam') && <TableCell className="text-right sticky right-0 bg-gray-900 border-l border-gray-600 text-white font-black z-10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.3)]">{formatNumber(dues.reduce((s, r) => {
                      const apt = apartments.find(a => a.daireNo === r.daireNo && a.blok === r.blok);
                      const isManager = apt?.isManager || false;
                      const bal = calculateBalance(r, isManager, apt?.asansorTabi || false);
                      const late = calculateLateFee(r, isManager);
                      return s + bal + late;
                  }, 0))}</TableCell>}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DuesSchedule;
