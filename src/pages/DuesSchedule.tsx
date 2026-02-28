import { Layout } from "@/components/Layout";
import { MONTHS, formatNumber, formatCurrency, MONTHLY_DUES, ELEVATOR_FEE } from "@/data/initialData";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Pencil, Save, Plus, Trash2, Download } from "lucide-react";
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
    updateDuesPayment,
    updateElevatorPayment,
    updateExtraFee,
    addDuesColumn,
    removeDuesColumn,
    year,
    monthlyDuesAmount, // Context'ten al
    currentMonthIndex, // Context'ten al
    updateMonthlyDuesAmount, // Context'ten al
    annualElevatorFee, // YENİ
    updateAnnualElevatorFee // YENİ
  } = useData();

  const [isEditing, setIsEditing] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isAddColOpen, setIsAddColOpen] = useState(false);
  const [isDeleteColOpen, setIsDeleteColOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [isEditingDuesAmount, setIsEditingDuesAmount] = useState(false);
  const [isEditingElevator, setIsEditingElevator] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState("all");
  // Local edit buffer: key = `${daireNo}_${month}`, value = string
  const [localEditValues, setLocalEditValues] = useState<Record<string, string>>({});

  const getLocalVal = (daireNo: number, month: string, fallback: number) => {
    const key = `${daireNo}_${month}`;
    return key in localEditValues ? localEditValues[key] : (fallback > 0 ? String(fallback) : '');
  };

  const handleDuesInputChange = (daireNo: number, month: string, val: string) => {
    setLocalEditValues(prev => ({ ...prev, [`${daireNo}_${month}`]: val }));
  };

  const handleDuesInputCommit = (daireNo: number, month: string) => {
    const key = `${daireNo}_${month}`;
    if (key in localEditValues) {
      const parsed = parseFloat(localEditValues[key]) || 0;
      updateDuesPayment(daireNo, month, parsed);
      setLocalEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const blocks = Array.from(new Set((apartments || []).map(a => a.blok).filter(Boolean))).sort();

  const filteredDues = selectedBlock === "all"
    ? (dues || [])
    : (dues || []).filter(d => {
      const apt = apartments.find(a => a.daireNo === d.daireNo);
      return apt?.blok === selectedBlock;
    }); // YENİ
  const [tempDuesAmount, setTempDuesAmount] = useState(monthlyDuesAmount);
  const [showFutureMonths, setShowFutureMonths] = useState(false);
  const showLateFees = true; // YENİ: Her zaman göster


  const toggleEdit = () => {
    if (isEditing) {
      toast.success("Düzenleme modu kapatıldı.");
    }
    setIsEditing(!isEditing);
  };

  const handleAddColumn = () => {
    if (newColumnName) {
      addDuesColumn(newColumnName);
      setNewColumnName("");
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

    // Use enhanced Excel export
    import('@/lib/exportUtils').then(({ exportToExcel }) => {
      exportToExcel(`Aidat_Cizelgesi_${year}`, {
        title: `${year} Yılı Aidat Ödeme Çizelgesi`,
        subtitle: `Saffet Sabancı Apartmanı - Aylık Aidat: ${formatCurrency(monthlyDuesAmount)}`,
        headers,
        rows,
        highlightColumns: [rows[0].length - 1], // Highlight balance column
        redIfNegative: [rows[0].length - 1] // Red if negative balance
      });
      toast.success('Tablo Excel dosyası olarak indirildi');
    });
  };

  // YENİ: Bakiye hesaplama - Sadece mevcut aya kadar
  const calculateBalance = (row: any, isManager: boolean, subjectToElevator: boolean) => {
    const devir = row.devredenBorc2024 || 0;

    // Sadece geçmiş ve mevcut ayların borcunu hesapla (Yönetici hariç)
    let totalDue = 0;
    MONTHS.forEach((m, idx) => {
      if (!isManager && idx <= currentMonthIndex) {
        totalDue += monthlyDuesAmount;
      }
    });

    // Yıllık Asansör Borcu
    if (subjectToElevator) {
      totalDue += annualElevatorFee;
    }

    // Gecikme Cezası
    const penalty = calculateLateFee(row, isManager);
    totalDue += penalty;

    // Toplam ödenen (Aidat + Asansör + Ekstra)
    // MonthlyDues içerisinde toplamOdenen zaten hesaplanmış olmalı veya burada hesaplayabiliriz.
    // Assuming context keeps 'toplamOdenen' updated properly including elevator payment.
    const totalPaid = row.toplamOdenen || 0;

    // Bakiye = Devir + Toplam Borç - Toplam Ödenen
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Aidat Ödeme Çizelgesi</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              {year} Yılı — Aylık Aidat:
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

          <div className="flex flex-col bg-white p-2 rounded-lg border shadow-sm items-end min-w-[150px]" style={{ textAlign: 'center' }}>
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
          <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors mr-2">
              <input
                type="checkbox"
                checked={showFutureMonths}
                onChange={(e) => setShowFutureMonths(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
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
                  checked={!hiddenColumns.includes('toplam')}
                  onCheckedChange={() => toggleColumn('toplam')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Toplam
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!hiddenColumns.includes('bakiye')}
                  onCheckedChange={() => toggleColumn('bakiye')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Bakiye
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" /> İndir
            </Button>

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

        {/* Add Column Dialog */}
        <Dialog open={isAddColOpen} onOpenChange={setIsAddColOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Sütun Ekle</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Sütun Başlığı (Örn: Yakıt Farkı)</Label>
              <Input value={newColumnName} onChange={e => setNewColumnName(e.target.value)} placeholder="Başlık giriniz..." />
            </div>
            <DialogFooter>
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
                      <span className="font-medium">{col}</span>
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

        <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-800 hover:bg-gray-800 border-b-2 border-gray-700">
                  {!hiddenColumns.includes('no') && <TableHead className="sticky left-0 bg-gray-800 z-20 w-[50px] text-center font-bold text-white shadow-[1px_0_0_0_rgba(255,255,255,0.1)] text-xs tracking-wider">NO</TableHead>}
                  {!hiddenColumns.includes('sakin') && <TableHead className="sticky left-[50px] bg-gray-800 z-20 min-w-[150px] font-bold text-white shadow-[1px_0_0_0_rgba(255,255,255,0.1)] text-xs tracking-wider">DAİRE SAKİNİ</TableHead>}
                  {!hiddenColumns.includes('devir') && <TableHead className="text-center font-bold min-w-[80px] bg-amber-700 text-amber-100 text-xs tracking-wider">DEVİR</TableHead>}
                  {MONTHS.map((month, idx) => {
                    if (!showFutureMonths && idx > currentMonthIndex) return null;
                    if (hiddenColumns.includes(month)) return null;
                    return (
                      <TableHead key={month} className="text-center min-w-[75px] font-bold text-xs text-gray-200 uppercase bg-gray-700 tracking-wider">
                        {month.slice(0, 3)}
                      </TableHead>
                    );
                  })}
                  {!hiddenColumns.includes('asansor') && <TableHead className="text-center font-bold bg-indigo-700 text-indigo-100 text-xs tracking-wider whitespace-nowrap">ASANSÖR</TableHead>}
                  {(duesColumns || []).map(col => !hiddenColumns.includes(col) && (
                    <TableHead key={col} className="text-center font-bold bg-sky-700 text-sky-100 text-xs">
                      <div className="flex items-center justify-center gap-1">
                        {col}
                        {isEditing && <Trash2 className="w-3 h-3 cursor-pointer text-red-300 hover:text-red-100" onClick={() => removeDuesColumn(col)} />}
                      </div>
                    </TableHead>
                  ))}
                  {!hiddenColumns.includes('yilToplam') && <TableHead className="text-center font-bold bg-gray-700 text-gray-200 text-xs tracking-wider whitespace-nowrap">YILLIK<br />TOPLAM</TableHead>}
                  {!hiddenColumns.includes('toplamOdenen') && <TableHead className="text-right font-bold bg-emerald-700 text-emerald-100 text-xs tracking-wider whitespace-nowrap">TOPLAM<br />ÖDENEN</TableHead>}
                  {!hiddenColumns.includes('borc') && <TableHead className="text-right font-bold bg-orange-700 text-orange-100 text-xs tracking-wider">BORÇ</TableHead>}
                  {!hiddenColumns.includes('gecikmeCezasi') && <TableHead className="text-right font-bold bg-red-700 text-red-100 text-xs tracking-wider whitespace-nowrap">%5 GECİKME<br />CEZASI</TableHead>}
                  {!hiddenColumns.includes('odenecekToplam') && <TableHead className="text-right font-bold bg-slate-900 text-white text-xs tracking-wider sticky right-0 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.3)] whitespace-nowrap">ÖDENECEKler<br />TOPLAM</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDues.map((row) => {
                  // Check if this apartment is manager
                  const apartment = apartments.find(apt => apt.daireNo === row.daireNo);
                  const isManager = apartment?.isManager || false;
                  const subjectToElevator = apartment?.asansorTabi || false;

                  const annualExpected = (isManager ? 0 : 12 * monthlyDuesAmount) + (subjectToElevator ? annualElevatorFee : 0);

                  const lateFee = calculateLateFee(row, isManager);
                  const displayBalance = calculateBalance(row, isManager, subjectToElevator); // YENİ: Mevcut aya göre bakiye
                  const isDebt = displayBalance > 0;

                  return (
                    <TableRow
                      key={row.daireNo}
                      className={`transition-colors group border-b border-slate-100 ${isManager
                        ? 'bg-purple-50/50 hover:bg-purple-100/50 opacity-60 cursor-not-allowed' // Disabled
                        : 'hover:bg-blue-50/50'
                        }`}
                    >
                      {!hiddenColumns.includes('no') && <TableCell className={`sticky left-0 ${isManager ? 'bg-purple-50/50 group-hover:bg-purple-100/50' : 'bg-white group-hover:bg-blue-50'} z-10 font-bold text-center border-r shadow-[1px_0_0_0_hsl(var(--border))] text-slate-700`}>
                        {row.daireNo}
                        {isManager && (
                          <span className="ml-1 text-[10px] text-purple-600">👤</span>
                        )}
                      </TableCell>}
                      {!hiddenColumns.includes('sakin') && <TableCell className={`sticky left-[50px] ${isManager ? 'bg-purple-50/50 group-hover:bg-purple-100/50' : 'bg-white group-hover:bg-blue-50'} z-10 font-medium text-xs whitespace-nowrap border-r shadow-[1px_0_0_0_hsl(var(--border))] text-slate-900`}>
                        {row.sakinAdi}
                      </TableCell>}
                      {!hiddenColumns.includes('devir') && <TableCell className={`text-center text-xs font-medium border-r bg-orange-50/30 ${row.devredenBorc2024 < 0 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                        {formatNumber(row.devredenBorc2024)}
                      </TableCell>}
                      {MONTHS.map((month, idx) => {
                        // Gelecek ayları göster/gizle kontrolü
                        if (!showFutureMonths && idx > currentMonthIndex) return null;
                        if (hiddenColumns.includes(month)) return null;

                        const val = row.odemeler[month] || 0;
                        const isPastMonth = idx < currentMonthIndex;
                        const isFullPaid = val >= monthlyDuesAmount;
                        const isUnpaid = !isManager && val < monthlyDuesAmount; // Yönetici muaf

                        let bgClass = "";
                        let cellClass = "";

                        if (isFullPaid) {
                          bgClass = "bg-emerald-200 text-emerald-900 font-bold shadow-sm";
                        } else if (isUnpaid && isPastMonth) { // Sadece geçmiş aylarda kırmızı
                          // BÜTÜN ÖDENMEYEN KUTUCUKLAR KIRMIZI!
                          bgClass = "bg-red-500 text-white font-extrabold shadow-lg";
                          cellClass = "bg-red-100 ring-2 ring-red-500";
                        } else if (isManager) {
                          bgClass = "text-purple-400 font-bold"; // Yönetici için özel stil
                        }

                        return (
                          <TableCell
                            key={month}
                            className={`p-1 text-center border-r border-slate-100 relative ${cellClass} ${isEditing ? 'bg-slate-50' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                <Input
                                  type="number"
                                  value={getLocalVal(row.daireNo, month, row.odemeler[month] || 0)}
                                  onChange={(e) => handleDuesInputChange(row.daireNo, month, e.target.value)}
                                  onBlur={() => handleDuesInputCommit(row.daireNo, month)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                                  className={`h-8 w-full min-w-[50px] text-right text-xs px-1 ${val > 0 ? 'bg-background font-semibold' : 'bg-background/50'}`}
                                  placeholder="0"
                                  disabled={isManager}
                                />
                                {!isFullPaid && !isManager && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-1 bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                                    onClick={() => updateDuesPayment(row.daireNo, month, monthlyDuesAmount)}
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
                      {!hiddenColumns.includes('asansor') && <TableCell className="text-center p-1 border-r border-indigo-100 bg-indigo-50/30">
                        {isEditing ? (
                          apartment?.asansorTabi ? (
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                value={row.asansorOdemesi || ''}
                                onChange={(e) => updateElevatorPayment(row.daireNo, parseFloat(e.target.value) || 0)}
                                className="h-8 w-16 text-right text-xs px-1 mx-auto"
                              />
                              {(row.asansorOdemesi || 0) < annualElevatorFee && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-1 bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-700"
                                  onClick={() => updateElevatorPayment(row.daireNo, annualElevatorFee)}
                                >
                                  ✓ Öde
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
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
                                <span className="text-[9px] text-gray-500 line-through decoration-red-300">
                                  Of {formatNumber(annualElevatorFee)}
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">-</span>
                          )
                        )}
                      </TableCell>}

                      {/* Extra Columns */}
                      {(duesColumns || []).map(col => !hiddenColumns.includes(col) && (
                        <TableCell key={col} className="text-center p-1 border-r border-sky-100 bg-sky-50/30">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={row.extraFees?.[col] || ''}
                              onChange={(e) => updateExtraFee(row.daireNo, col, parseFloat(e.target.value) || 0)}
                              className="h-8 w-16 text-right text-xs px-1 mx-auto"
                            />
                          ) : (
                            <span className="text-xs font-medium text-sky-700">{formatNumber(row.extraFees?.[col] || 0)}</span>
                          )}
                        </TableCell>
                      ))}

                      {/* Annual Total */}
                      {!hiddenColumns.includes('yilToplam') && <TableCell className="text-center text-xs font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                        {formatNumber(annualExpected)}
                      </TableCell>}

                      {/* Total Paid */}
                      {!hiddenColumns.includes('toplamOdenen') && <TableCell className="text-right text-xs font-bold bg-emerald-50/30 text-emerald-700 border-r border-emerald-100">
                        {formatNumber(row.toplamOdenen)}
                      </TableCell>}

                      {/* Balance */}
                      {!hiddenColumns.includes('bakiye') && <TableCell className={`text-right sticky right-0 bg-white group-hover:bg-blue-50/50 border-l shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]`}>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${isDebt ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
                          {formatNumber(displayBalance)}
                        </span>
                      </TableCell>}

                      {showLateFees && (
                        <TableCell className="text-right text-xs text-destructive font-medium bg-red-50/50">
                          {lateFee > 0 ? formatNumber(lateFee) : "—"}
                        </TableCell>
                      )}
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
                  {!hiddenColumns.includes('borc') && <TableCell />}
                  {!hiddenColumns.includes('gecikmeCezasi') && <TableCell />}
                  {!hiddenColumns.includes('odenecekToplam') && <TableCell className="text-right sticky right-0 bg-gray-800 text-white">{formatNumber(dues.reduce((s, r) => s + r.odenecekToplamBorc, 0))}</TableCell>}
                  {showLateFees && <TableCell />}
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
