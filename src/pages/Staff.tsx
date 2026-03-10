import { Layout } from "@/components/Layout";
import { MONTHS, formatCurrency, formatNumber } from "@/data/initialData";
import { User, Banknote, Shield, Clock, Download, Pencil, Save, X } from "lucide-react";
import { exportToCSV } from "@/lib/exportUtils";
import { useData } from "@/context/DataContext";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Staff = () => {
  const { staffRecords, updateStaffRecord, year, staffName, staffRole, updateStaffInfo, isLoading, ledger } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(staffName);
  const [tempRole, setTempRole] = useState(staffRole);
  const [localRecords, setLocalRecords] = useState(staffRecords);

  // Sync local records when staffRecords from context change (e.g. after load)
  useEffect(() => {
    if (!isEditing) {
      setLocalRecords(staffRecords);
      setTempName(staffName);
      setTempRole(staffRole);
    }
  }, [staffRecords, staffName, staffRole, isEditing]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">Personel verileri yükleniyor...</p>
        </div>
      </Layout>
    );
  }

  const getLedgerStaffPayments = (month: string) => {
    const monthData = ledger[month];
    if (!monthData) return 0;
    return monthData.giderler
      .filter((g: any) => g.kategori === 'Kapıcı Aylık' || g.kategori === 'Personel Ödemesi' || String(g.aciklama).startsWith('staff_payment_'))
      .reduce((sum: number, g: any) => sum + g.tutar, 0);
  };

  const totalMaas = localRecords.reduce((s, r) => s + r.maas, 0);
  const totalMesai = localRecords.reduce((s, r) => s + r.mesai, 0);
  const totalOdenen = localRecords.reduce((s, r) => s + Math.max(r.toplamOdenen, getLedgerStaffPayments(r.ay)), 0);
  const monthlyTazminat = 500;
  const activemonths = localRecords.filter((r) => r.maas > 0).length;
  const toplamTazminat = activemonths * monthlyTazminat;

  const handleExport = () => {
    const headers = ['Ay', 'Maaş', 'Mesai', 'Ödenen', 'Avans', 'Alacak', 'Toplam Ödenen', 'Tazminat'];
    const rows = localRecords.map((r) => [
      r.ay,
      r.maas,
      r.mesai,
      r.odenen,
      r.avans,
      r.alacak,
      r.toplamOdenen,
      r.maas > 0 ? monthlyTazminat : 0,
    ]);
    rows.push(['TOPLAM', totalMaas, totalMesai, localRecords.reduce((s, r) => s + r.odenen, 0), localRecords.reduce((s, r) => s + r.avans, 0), localRecords.reduce((s, r) => s + r.alacak, 0), totalOdenen, toplamTazminat]);
    exportToCSV(`${tempName}_Bordro_${year}`, headers, rows);
  };

  const toggleEdit = () => {
    if (isEditing) {
      // Save everything
      updateStaffInfo(tempName, tempRole);

      // Update all records that changed
      localRecords.forEach((record, idx) => {
        const original = staffRecords[idx];
        if (JSON.stringify(record) !== JSON.stringify(original)) {
          updateStaffRecord(record.ay, {
            maas: record.maas,
            mesai: record.mesai,
            odenen: record.odenen,
            avans: record.avans,
            alacak: record.alacak,
            toplamOdenen: record.toplamOdenen
          });
        }
      });
      toast.success("Değişiklikler kaydedildi.");
    }
    setIsEditing(!isEditing);
  }

  // Helper to update specific field in local state
  const updateLocalField = (ay: string, field: string, val: string) => {
    const numVal = parseFloat(val) || 0;
    setLocalRecords(prev => prev.map(r =>
      r.ay === ay ? { ...r, [field]: numVal } : r
    ));
  }

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Personel Takibi</h1>
            <p className="page-subtitle">
              Personel bordro ve tazminat takip ekranı — {year}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleEdit}
              variant={isEditing ? "default" : "outline"}
              className={`gap-2 ${isEditing ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {isEditing ? "Kaydet ve Bitir" : "Düzenle"}
            </Button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV İndir
            </button>
          </div>
        </div>

        {/* Staff Info Card */}
        <div className="stat-card-accent mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground/20">
              <User className="h-7 w-7" />
            </div>
            <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <div className="space-y-1">
                      <Label htmlFor="staffName" className="text-primary-foreground/80 text-xs">Personel Adı Soyadı</Label>
                      <Input
                        id="staffName"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-9"
                        placeholder="İsim Soyisim"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="staffRole" className="text-primary-foreground/80 text-xs">Görevi</Label>
                      <Input
                        id="staffRole"
                        value={tempRole}
                        onChange={(e) => setTempRole(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-9"
                        placeholder="Örn: Apartman Görevlisi"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{staffName}</h2>
                    <p className="text-sm opacity-80">{staffRole}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">Ortalama Maaş</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalMaas / (activemonths || 1))}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">Toplam Ödenen</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalOdenen)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm text-muted-foreground">Aylık Tazminat</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(monthlyTazminat)}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-warning" />
              <span className="text-sm text-muted-foreground">Biriken Tazminat</span>
            </div>
            <p className="text-xl font-bold text-warning">{formatCurrency(toplamTazminat)}</p>
            <p className="text-xs text-muted-foreground mt-1">{activemonths} ay</p>
          </div>
        </div>

        {/* Monthly Table */}
        <div className="stat-card overflow-x-auto">
          <h3 className="font-semibold text-foreground mb-4">
            {year} Yılı Aylık Bordro Tablosu
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ay</th>
                <th className="text-right">Maaş</th>
                <th className="text-right">Mesai</th>
                <th className="text-right">Ödenen</th>
                <th className="text-right">Avans</th>
                <th className="text-right">Alacak</th>
                <th className="text-right">Toplam Ödenen</th>
                <th className="text-right">Tazminat</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {localRecords.map((row, i) => {
                const isActive = row.maas > 0;
                const ledgerPaid = getLedgerStaffPayments(row.ay);
                const displayOdenen = Math.max(row.toplamOdenen, ledgerPaid);

                return (
                  <tr key={row.ay} className={!isActive && !isEditing ? "opacity-40 hover:opacity-100 transition-opacity" : "hover:bg-muted/30"}>
                    <td className="font-medium">{row.ay}</td>

                    {/* Maaş */}
                    <td className="text-right p-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.maas}
                          onChange={(e) => updateLocalField(row.ay, 'maas', e.target.value)}
                          className="h-8 w-20 ml-auto text-right text-xs"
                        />
                      ) : formatNumber(row.maas)}
                    </td>

                    {/* Mesai */}
                    <td className="text-right p-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.mesai}
                          onChange={(e) => updateLocalField(row.ay, 'mesai', e.target.value)}
                          className="h-8 w-20 ml-auto text-right text-xs"
                        />
                      ) : formatNumber(row.mesai)}
                    </td>

                    {/* Ödenen */}
                    <td className="text-right p-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.odenen}
                          onChange={(e) => updateLocalField(row.ay, 'odenen', e.target.value)}
                          className="h-8 w-20 ml-auto text-right text-xs"
                        />
                      ) : formatNumber(row.odenen)}
                    </td>

                    {/* Avans */}
                    <td className="text-right p-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.avans}
                          onChange={(e) => updateLocalField(row.ay, 'avans', e.target.value)}
                          className="h-8 w-20 ml-auto text-right text-xs"
                        />
                      ) : formatNumber(row.avans)}
                    </td>

                    {/* Alacak */}
                    <td className="text-right p-1">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.alacak}
                          onChange={(e) => updateLocalField(row.ay, 'alacak', e.target.value)}
                          className="h-8 w-20 ml-auto text-right text-xs"
                        />
                      ) : formatNumber(row.alacak)}
                    </td>

                    {/* Toplam Ödenen */}
                    <td className="text-right p-1 font-semibold">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={row.toplamOdenen}
                          onChange={(e) => updateLocalField(row.ay, 'toplamOdenen', e.target.value)}
                          className="h-8 w-24 ml-auto text-right font-bold text-xs"
                        />
                      ) : formatNumber(displayOdenen)}
                    </td>

                    <td className="text-right text-muted-foreground p-1">
                      {isActive || (isEditing && row.maas > 0) ? formatNumber(monthlyTazminat) : "—"}
                    </td>
                    <td className="p-1">
                      {isActive && displayOdenen > 0 ? (
                        <span className="status-paid">Ödendi</span>
                      ) : isActive ? (
                        <span className="text-xs text-orange-600 font-medium">Bekliyor</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-bold">
                <td>TOPLAM</td>
                <td className="text-right">{formatNumber(totalMaas)}</td>
                <td className="text-right">{formatNumber(totalMesai)}</td>
                <td className="text-right">{formatNumber(localRecords.reduce((s, r) => s + r.odenen, 0))}</td>
                <td className="text-right">{formatNumber(localRecords.reduce((s, r) => s + r.avans, 0))}</td>
                <td className="text-right">{formatNumber(localRecords.reduce((s, r) => s + r.alacak, 0))}</td>
                <td className="text-right">{formatNumber(totalOdenen)}</td>
                <td className="text-right">{formatNumber(toplamTazminat)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p className="text-[10px] text-muted-foreground mt-4 italic">
            * Personel 'Toplam Ödenen' sütunu güncellendiğinde işletme defterine otomatik gider kaydı olarak işlenir.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Staff;
