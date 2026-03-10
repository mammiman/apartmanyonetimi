import { Layout } from "@/components/Layout";
import { Building2, User, Home, CheckCircle2, XCircle, Pencil, Save, X, Plus, Trash2, CreditCard, Phone, FileText, Printer } from "lucide-react";
import { useData } from "@/context/DataContext";
import { useState } from "react";
import { printReceipt } from "@/lib/printUtils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Apartment, MONTHS } from "@/data/initialData";
import { AccessCodeGenerator } from "@/components/AccessCodeGenerator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Apartments = () => {
  const {
    apartments,
    updateApartment,
    addApartment,
    deleteApartment,
    updateDuesPayment,
    updateElevatorPayment,
    duesColumns,
    updateExtraFee,
    apartmentName,
    isLoading
  } = useData();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">Daire listesi yükleniyor...</p>
        </div>
      </Layout>
    );
  }
  const [editingApt, setEditingApt] = useState<Apartment | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newApt, setNewApt] = useState<Apartment>({
    daireNo: 0,
    sakinAdi: "",
    mulkSahibi: "",
    asansorTabi: true,
    blok: "A" // YENİ: Varsayılan Blok
  });

  const [selectedBlock, setSelectedBlock] = useState("all");

  // Calculate unique blocks
  const blocks = Array.from(new Set(apartments.map(a => a.blok).filter(Boolean))).sort();

  // Filter apartments
  const filteredApartments = selectedBlock === "all"
    ? apartments
    : apartments.filter(a => a.blok === selectedBlock);

  // Payment states
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<string>("aidat");
  const [paymentMonth, setPaymentMonth] = useState<string>("OCAK");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentApt, setPaymentApt] = useState<Apartment | null>(null);

  // Access code state
  const [accessCodeApt, setAccessCodeApt] = useState<Apartment | null>(null);

  // Receipt state
  const [receiptApt, setReceiptApt] = useState<Apartment | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<string>("");
  const [receiptDesc, setReceiptDesc] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const openReceiptDialog = (e: React.MouseEvent, apt: Apartment) => {
    e.stopPropagation();
    setReceiptApt(apt);
    setReceiptAmount("");
    setReceiptDesc("Aidat Ödemesi");
    setReceiptDate(new Date().toISOString().split('T')[0]);
  };

  const handlePrintReceipt = () => {
    if (!receiptApt) return;
    printReceipt({
      type: 'gelir',
      amount: parseFloat(receiptAmount) || 0,
      desc: receiptDesc,
      date: receiptDate,
      name: `${receiptApt.sakinAdi} (Daire: ${receiptApt.daireNo})`,
      apartmentName
    });
    // Don't close immediately just in case user wants to reprint or edit
    // setReceiptApt(null); 
  };

  const handleSave = () => {
    if (editingApt) {
      // Find the original apartment to get its original daireNo and blok
      const originalApt = apartments.find(a => 
        (a.id !== undefined && a.id === editingApt.id)
      ) || apartments.find(a => a.daireNo === editingApt.daireNo && a.blok === editingApt.blok) || editingApt;

      updateApartment(editingApt.daireNo, editingApt, originalApt.blok);
      setEditingApt(null);
      toast.success(`Daire ${editingApt.daireNo} (${editingApt.blok || ''}) güncellendi.`);
    }
  };

  const handleAdd = () => {
    const daireNo = newApt.daireNo || apartments.length + 1;
    addApartment({ ...newApt, daireNo });
    setIsAddOpen(false);
    setNewApt({ daireNo: 0, sakinAdi: "", mulkSahibi: "", asansorTabi: true, blok: "A" });
  };

  const handleDelete = () => {
    if (editingApt) {
      deleteApartment(editingApt.daireNo, editingApt.blok);
      setEditingApt(null);
    }
  };

  const openPaymentDialog = (e: React.MouseEvent, apt: Apartment) => {
    e.stopPropagation(); // Prevent card click
    setPaymentApt(apt);
    setPaymentAmount("");
    setIsPaymentOpen(true);
  };

  const submitPayment = () => {
    if (!paymentApt || !paymentAmount) return;
    const amount = parseFloat(paymentAmount) || 0;

    if (paymentType === "aidat") {
      updateDuesPayment(paymentApt.daireNo, paymentMonth, amount, paymentApt.blok);
      toast.success(`Daire ${paymentApt.daireNo} (${paymentApt.blok || ''}) için ${paymentMonth} aidatı güncellendi: ${amount} TL`);
    } else if (paymentType === "asansor") {
      updateElevatorPayment(paymentApt.daireNo, amount, paymentApt.blok);
      toast.success(`Daire ${paymentApt.daireNo} (${paymentApt.blok || ''}) için asansör ödemesi güncellendi: ${amount} TL`);
    } else {
      updateExtraFee(paymentApt.daireNo, paymentType, amount, paymentApt.blok);
      toast.success(`Daire ${paymentApt.daireNo} (${paymentApt.blok || ''}) için ${paymentType} ödemesi güncellendi: ${amount} TL`);
    }
    setIsPaymentOpen(false);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="page-header flex justify-between items-center mb-6">
          <div>
            <h1 className="page-title">Daire Yönetimi</h1>
            <p className="page-subtitle">
              {apartmentName} — Toplam {apartments.length} Daire
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Daire Ekle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni Daire Ekle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Daire No</Label><Input type="number" value={newApt.daireNo || ""} onChange={e => setNewApt({ ...newApt, daireNo: parseInt(e.target.value) || 0 })} placeholder={String(apartments.length + 1)} /></div>
                    <div><Label>Blok</Label><Input value={newApt.blok || ""} onChange={e => setNewApt({ ...newApt, blok: e.target.value })} placeholder="A" /></div>
                    <div><Label>Sakin Adı</Label><Input value={newApt.sakinAdi} onChange={e => setNewApt({ ...newApt, sakinAdi: e.target.value })} /></div>
                  </div>
                  <div><Label>Sakin Telefon</Label><Input value={newApt.residentPhone || ""} onChange={e => setNewApt({ ...newApt, residentPhone: e.target.value })} placeholder="05XX..." /></div>
                  <div><Label>Mülk Sahibi</Label><Input value={newApt.mulkSahibi} onChange={e => setNewApt({ ...newApt, mulkSahibi: e.target.value })} /></div>
                  <div><Label>Mülk Sahibi Tel</Label><Input value={newApt.ownerPhone || ""} onChange={e => setNewApt({ ...newApt, ownerPhone: e.target.value })} placeholder="05XX..." /></div>
                  <div className="flex items-center gap-2">
                    <Switch checked={newApt.asansorTabi} onCheckedChange={c => setNewApt({ ...newApt, asansorTabi: c })} />
                    <Label>Asansör Tabi</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={newApt.isManager || false} onCheckedChange={c => setNewApt({ ...newApt, isManager: c })} />
                    <Label className="text-purple-700 font-semibold">👤 Yönetici (Giderlerden Muaf)</Label>
                  </div>
                </div>
                <DialogFooter><Button onClick={handleAdd}>Ekle</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Receipt Dialog */}
        <Dialog open={!!receiptApt} onOpenChange={(open) => !open && setReceiptApt(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Makbuz Oluştur</DialogTitle>
              <DialogDescription>
                Daire {receiptApt?.daireNo} - {receiptApt?.sakinAdi} için makbuz detaylarını giriniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="receipt-date" className="text-right">Tarih</Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="receipt-amount" className="text-right">Tutar (TL)</Label>
                <Input
                  id="receipt-amount"
                  type="number"
                  placeholder="0.00"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="receipt-desc" className="text-right">Açıklama</Label>
                <Input
                  id="receipt-desc"
                  placeholder="Örn: Ocak 2026 Aidat"
                  value={receiptDesc}
                  onChange={(e) => setReceiptDesc(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setReceiptApt(null)}>İptal</Button>
              <Button onClick={handlePrintReceipt}>
                <Printer className="w-4 h-4 mr-2" />
                Yazdır
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hızlı Ödeme Ekle: Daire {paymentApt?.daireNo}</DialogTitle>
              <DialogDescription>{paymentApt?.sakinAdi}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Ödeme Tipi</Label>
                <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aidat">Aidat</SelectItem>
                    <SelectItem value="asansor">Asansör</SelectItem>
                    {duesColumns.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentType === "aidat" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Ay</Label>
                  <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Tutar (TL)</Label>
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="col-span-3" placeholder="0.00" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitPayment}>Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={!!editingApt} onOpenChange={(open) => !open && setEditingApt(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Daire Düzenle: Daire {editingApt?.daireNo}</DialogTitle>
              <DialogDescription>Daire bilgilerini güncelleyebilir veya daireyi silebilirsiniz.</DialogDescription>
            </DialogHeader>
            {editingApt && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Daire No</Label>
                  <Input
                    type="number"
                    value={editingApt.daireNo}
                    onChange={(e) => setEditingApt({ ...editingApt, daireNo: parseInt(e.target.value) || 0 })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Blok</Label>
                  <Input
                    value={editingApt.blok || ""}
                    onChange={(e) => setEditingApt({ ...editingApt, blok: e.target.value })}
                    className="col-span-3"
                    placeholder="A"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Sakin Adı</Label>
                  <Input
                    value={editingApt.sakinAdi || ""}
                    onChange={(e) => setEditingApt({ ...editingApt, sakinAdi: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Sakin Tel</Label>
                  <Input
                    value={editingApt.residentPhone || ""}
                    onChange={(e) => setEditingApt({ ...editingApt, residentPhone: e.target.value })}
                    className="col-span-3"
                    placeholder="05XX..."
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Mülk Sahibi</Label>
                  <Input
                    value={editingApt.mulkSahibi || ""}
                    onChange={(e) => setEditingApt({ ...editingApt, mulkSahibi: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Mülk S. Tel</Label>
                  <Input
                    value={editingApt.ownerPhone || ""}
                    onChange={(e) => setEditingApt({ ...editingApt, ownerPhone: e.target.value })}
                    className="col-span-3"
                    placeholder="05XX..."
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Asansör</Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      checked={editingApt.asansorTabi}
                      onCheckedChange={(c) => setEditingApt({ ...editingApt, asansorTabi: c })}
                    />
                    <Label>Asansör Tabi</Label>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Yönetici</Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      checked={editingApt.isManager || false}
                      onCheckedChange={(c) => setEditingApt({ ...editingApt, isManager: c })}
                    />
                    <Label className="text-purple-700 font-semibold">👤 Giderlerden Muaf</Label>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-between sm:justify-between w-full">
              <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" /> Sil</Button>
              <Button onClick={handleSave}>Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {blocks.length > 0 && (
          <Tabs value={selectedBlock} onValueChange={setSelectedBlock} className="w-full mb-6">
            <TabsList>
              <TabsTrigger value="all">Tümü ({apartments.length})</TabsTrigger>
              {blocks.map(b => (
                <TabsTrigger key={b} value={b!}>{b} Blok</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredApartments.map((apt) => (
            <div
              key={`${apt.blok || ''}-${apt.daireNo}`}
              className="stat-card group hover:border-accent/40 relative cursor-pointer"
              onClick={() => setEditingApt(apt)}
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" onClick={(e) => openPaymentDialog(e, apt)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Ödeme Al
                </Button>
                <Button variant="outline" size="sm" onClick={(e) => openReceiptDialog(e, apt)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Makbuz
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditingApt(apt)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <span className="text-sm font-bold text-primary">
                      {apt.daireNo}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary">
                      {apt.blok ? `${apt.blok} Blok` : ''}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Daire No
                    </span>
                  </div>
                  {apt.isManager && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">
                      👤 YÖNETİCİ
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center gap-1 text-xs ${apt.asansorTabi ? "text-success" : "text-muted-foreground"
                    }`}
                >
                  {apt.asansorTabi ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  <span>Asansör</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sakin</p>
                    <p className="text-sm font-medium text-foreground">
                      {apt.sakinAdi}
                    </p>
                  </div>
                  {apt.residentPhone && (
                    <div className="flex items-center ml-auto text-sm font-semibold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-200 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                      <Phone className="w-3 h-3 mr-1.5" />
                      {apt.residentPhone}
                    </div>
                  )}
                </div>

                {apt.mulkSahibi && (
                  <div className="flex items-start gap-2">
                    <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mülk Sahibi</p>
                      <p className="text-sm font-medium text-foreground">
                        {apt.mulkSahibi}
                      </p>
                    </div>
                    {apt.ownerPhone && (
                      <div className="flex items-center ml-auto text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-200 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800">
                        <Phone className="w-3 h-3 mr-1" />
                        {apt.ownerPhone}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4 pt-4 border-t" >
                {apt.accessCode && (
                  <div className="flex items-center text-xs font-mono bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-700">
                    <span className="mr-1">🔑</span> {apt.accessCode}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccessCodeApt(apt);
                  }}
                >
                  {apt.accessCode ? '🔄 Kodu Yenile' : '🔑 Erişim Kodu'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Access Code Generator Dialog */}
        {
          accessCodeApt && (
            <AccessCodeGenerator
              apartmentNo={accessCodeApt.daireNo}
              residentName={accessCodeApt.sakinAdi}
              block={accessCodeApt.blok}
              isOpen={!!accessCodeApt}
              onClose={() => setAccessCodeApt(null)}
            />
          )
        }
      </div >
    </Layout >
  );
};

export default Apartments;
