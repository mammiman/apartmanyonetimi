
import React, { createContext, useContext, useState, useEffect } from "react";
import {
    Apartment,
    MonthlyDues,
    StaffRecord,
    MonthlySummary,
    LedgerParams,
    LedgerRow,
    apartments as initialApartments,
    duesSchedule as initialDues,
    staffRecords as initialStaffRecords,
    monthlySummary as initialMonthlySummary,
    initialLedgerData,
    MONTHLY_DUES,
    MONTHS
} from "@/data/initialData";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { generateAndSaveAccessCode, supabase } from "@/lib/supabase";

// Define App Data Structure for yearly storage
export interface ExpenseItem {
    id: number;
    description: string;
    amount: number;
    quantity: number;
    unit: string;
}

export interface LogEntry {
    id: number;
    date: string;
    action: string;
    details: string;
    user?: string;
}

interface AppData {
    dues: MonthlyDues[];
    ledger: LedgerParams;
    monthlySummary: MonthlySummary[];
    staffRecords: StaffRecord[];
    // Apartments usually shared/static or per year? If residents change, per year is safer but apartments structure is physical. 
    // Resident names are in apartments. So per year.
    apartments: Apartment[];
    duesColumns: string[];
}

interface DataContextType {
    year: number;
    dues: MonthlyDues[];
    apartments: Apartment[];
    staffRecords: StaffRecord[];
    monthlySummary: MonthlySummary[];
    ledger: LedgerParams;
    duesColumns: string[];
    availableYears: number[];
    monthlyDuesAmount: number; // YENİ: Aylık aidat tutarı
    currentMonthIndex: number; // YENİ: Mevcut ay index'i (0-11)
    apartmentName: string; // YENİ: Apartman Adı
    annualElevatorFee: number; // YENİ: Yıllık Asansör Ücreti
    expenseItems: ExpenseItem[]; // YENİ: Gider Kalemleri
    logs: LogEntry[]; // YENİ: Loglar
    staffName: string; // YENİ: Personel Adı
    staffRole: string; // YENİ: Personel Görevi

    // Actions
    addLog: (action: string, details: string) => void; // YENİ
    updateApartmentName: (name: string) => void;
    updateStaffInfo: (name: string, role: string) => void; // YENİ
    updateExpenseItem: (id: number, item: Partial<ExpenseItem>) => void;
    updateDuesPayment: (daireNo: number, month: string, amount: number) => void;
    updateExtraFee: (daireNo: number, column: string, amount: number) => void;
    updateElevatorPayment: (daireNo: number, amount: number) => void;
    updateAnnualElevatorFee: (amount: number) => void; // YENİ
    updateApartment: (daireNo: number, data: Partial<Apartment>) => void;
    addExpenseItem: (item: Omit<ExpenseItem, 'id'>) => void; // YENİ
    removeExpenseItem: (id: number) => void; // YENİ
    addApartment: (apt: Apartment) => void;
    deleteApartment: (daireNo: number) => void;
    updateStaffRecord: (month: string, data: Partial<StaffRecord>) => void;
    addLedgerEntry: (month: string, type: 'gelir' | 'gider', entry: Omit<LedgerRow, 'id'>) => void;
    deleteLedgerEntry: (month: string, type: 'gelir' | 'gider', id: number) => void;
    addDuesColumn: (name: string) => void;
    removeDuesColumn: (name: string) => void;
    updateMonthlyDuesAmount: (amount: number) => void;
    updateMonthlySummaryRow: (ay: string, field: string, value: number) => void; // YENİ: İcmal satırı güncelle
    startNewYear: () => void;
    switchYear: (targetYear: number) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Building-scoped localStorage key helper
    const buildingId = localStorage.getItem("selectedBuildingId") || "default";
    const bKey = (key: string) => `b_${buildingId}_${key}`;

    // Current Year State
    const [year, setYear] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_year"));
        return saved ? parseInt(saved) : new Date().getFullYear();
    });

    // We keep "Active" state for immediate binding
    const [dues, setDues] = useState<MonthlyDues[]>(() => {
        const saved = localStorage.getItem(bKey("app_dues"));
        return saved ? JSON.parse(saved) : initialDues;
    });

    const [apartments, setApartments] = useState<Apartment[]>(() => {
        const saved = localStorage.getItem(bKey("app_apartments"));
        return saved ? JSON.parse(saved) : initialApartments;
    });

    const [staffRecords, setStaffRecords] = useState<StaffRecord[]>(() => {
        const saved = localStorage.getItem(bKey("app_staffRecords"));
        return saved ? JSON.parse(saved) : initialStaffRecords;
    });

    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>(() => {
        const saved = localStorage.getItem(bKey("app_monthlySummary"));
        return saved ? JSON.parse(saved) : initialMonthlySummary;
    });

    const [ledger, setLedger] = useState<LedgerParams>(() => {
        const saved = localStorage.getItem(bKey("app_ledger"));
        return saved ? JSON.parse(saved) : initialLedgerData;
    });

    const [duesColumns, setDuesColumns] = useState<string[]>(() => {
        const saved = localStorage.getItem(bKey("app_duesColumns"));
        return saved ? JSON.parse(saved) : [];
    });

    // YENİ: Aylık aidat tutarı
    const [monthlyDuesAmount, setMonthlyDuesAmount] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_monthlyDuesAmount"));
        return saved ? parseFloat(saved) : MONTHLY_DUES;
    });

    // YENİ: Mevcut ay index'i (canlı tarih)
    const currentMonthIndex = (() => {
        const now = new Date();
        return now.getMonth(); // 0 = Ocak, 1 = Şubat, ..., 11 = Aralık
    })();

    // YENİ: Apartman Adı
    const [apartmentName, setApartmentName] = useState<string>(() => {
        return localStorage.getItem(bKey("app_apartmentName")) || "Apartman";
    });

    // YENİ: Aylık Asansör Ücreti
    const [monthlyElevatorFee, setMonthlyElevatorFee] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_monthlyElevatorFee"));
        return saved ? parseFloat(saved) : 50;
    });

    // YENİ: Gider Kalemleri
    const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(() => {
        const saved = localStorage.getItem(bKey("app_expenseItems"));
        if (saved) return JSON.parse(saved);

        // Varsayılan Kalemler
        return [
            { id: 1, description: "YÖNETİM VE HUZUR HAKKI", amount: 3000, quantity: 23, unit: "TL" },
            { id: 2, description: "TEMİZLİK MALZ. VE SU GİDERİ", amount: 2000, quantity: 23, unit: "TL" },
            { id: 3, description: "ELEKTRİK GİDERİ", amount: 1500, quantity: 23, unit: "TL" },
            { id: 4, description: "KAPICI AYLIK", amount: 6500, quantity: 23, unit: "TL" },
            { id: 5, description: "TAZMİNAT", amount: 750, quantity: 23, unit: "TL" },
            { id: 6, description: "KAPICI SSK PRİMİ", amount: 3200, quantity: 23, unit: "TL" },
            { id: 7, description: "MUHASEBE", amount: 1200, quantity: 23, unit: "TL" },
            { id: 8, description: "ASANSÖR PERİYODİK BAKIM-ONARIM", amount: 3800, quantity: 23, unit: "TL" },
            { id: 9, description: "ÖNGÖRÜLEMEYEN GİDERLERİ", amount: 2500, quantity: 23, unit: "TL" },
            { id: 10, description: "YENİMAHALLE BEL. YILLIK ASANSÖR MUAYENE BEDELİ", amount: 750, quantity: 23, unit: "TL" },
        ];
    });

    // YENİ: Loglar
    const [logs, setLogs] = useState<LogEntry[]>(() => {
        const saved = localStorage.getItem(bKey("app_logs"));
        return saved ? JSON.parse(saved) : [];
    });

    // YENİ: Personel Bilgileri
    const [staffName, setStaffName] = useState<string>(() => {
        return localStorage.getItem(bKey("app_staffName")) || "Belirtilmemiş";
    });
    const [staffRole, setStaffRole] = useState<string>(() => {
        return localStorage.getItem(bKey("app_staffRole")) || "Personel";
    });

    // Persistence
    useEffect(() => { localStorage.setItem(bKey("app_staffName"), staffName); }, [staffName]);
    useEffect(() => { localStorage.setItem(bKey("app_staffRole"), staffRole); }, [staffRole]);

    // Persistence
    useEffect(() => { localStorage.setItem(bKey("app_apartmentName"), apartmentName); }, [apartmentName]);
    useEffect(() => { localStorage.setItem(bKey("app_expenseItems"), JSON.stringify(expenseItems)); }, [expenseItems]);
    useEffect(() => { localStorage.setItem(bKey("app_logs"), JSON.stringify(logs)); }, [logs]);

    // Store available years to allow switching
    const [availableYears, setAvailableYears] = useState<number[]>(() => {
        const saved = localStorage.getItem(bKey("app_available_years"));
        return saved ? JSON.parse(saved) : [new Date().getFullYear()];
    });

    // YENİ: Annual Elevator Fee State
    const [annualElevatorFee, setAnnualElevatorFee] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_annualElevatorFee"));
        return saved ? parseFloat(saved) : 600;
    });

    // Save to localStorage
    useEffect(() => { localStorage.setItem(bKey("app_year"), year.toString()); }, [year]);
    useEffect(() => { localStorage.setItem(bKey("app_dues"), JSON.stringify(dues)); }, [dues]);
    useEffect(() => { localStorage.setItem(bKey("app_apartments"), JSON.stringify(apartments)); }, [apartments]);
    useEffect(() => { localStorage.setItem(bKey("app_staffRecords"), JSON.stringify(staffRecords)); }, [staffRecords]);
    useEffect(() => { localStorage.setItem(bKey("app_monthlySummary"), JSON.stringify(monthlySummary)); }, [monthlySummary]);
    useEffect(() => { localStorage.setItem(bKey("app_ledger"), JSON.stringify(ledger)); }, [ledger]);
    useEffect(() => { localStorage.setItem(bKey("app_duesColumns"), JSON.stringify(duesColumns)); }, [duesColumns]);
    useEffect(() => { localStorage.setItem(bKey("app_monthlyDuesAmount"), monthlyDuesAmount.toString()); }, [monthlyDuesAmount]);
    useEffect(() => { localStorage.setItem(bKey("app_apartmentName"), apartmentName); }, [apartmentName]);
    useEffect(() => { localStorage.setItem(bKey("app_expenseItems"), JSON.stringify(expenseItems)); }, [expenseItems]);
    // Save annual elevator fee
    useEffect(() => { localStorage.setItem(bKey("app_annualElevatorFee"), annualElevatorFee.toString()); }, [annualElevatorFee]);
    useEffect(() => { localStorage.setItem(bKey("app_available_years"), JSON.stringify(availableYears)); }, [availableYears]);

    // Fetch Remote Data
    useEffect(() => {
        const loadRemoteData = async () => {
            if (!buildingId) return;
            try {
                const [remoteApts, remoteDues, remoteCols, remoteStaff, remoteLogs] = await Promise.all([
                    api.fetchApartments(buildingId),
                    api.fetchDues(year),
                    api.fetchDuesColumns(buildingId),
                    api.fetchStaffRecords(buildingId),
                    api.fetchLogs(buildingId)
                ]);

                if (remoteApts) setApartments(remoteApts);
                if (remoteDues) setDues(remoteDues);
                if (remoteCols) setDuesColumns(remoteCols);
                if (remoteStaff) setStaffRecords(remoteStaff);

                let hasRemoteLedger = false;
                const newLedger = { ...initialLedgerData };
                for (const month of MONTHS) {
                    const entries = await api.fetchLedgerEntries(month, buildingId).catch(() => null);
                    if (entries && (entries.gelirler.length > 0 || entries.giderler.length > 0)) {
                        newLedger[month] = entries;
                        hasRemoteLedger = true;
                    }
                }
                // Always set ledger exactly to DB state (empty or not) to avoid phantom data
                setLedger(newLedger);

                if (remoteLogs) {
                    setLogs(remoteLogs.map(l => ({
                        id: l.id,
                        date: l.created_at,
                        action: l.action,
                        details: l.details,
                        user: l.user
                    })));
                }
            } catch (err) {
                console.error("Data fetch error", err);
            }
        };
        loadRemoteData();
    }, [buildingId, year]);

    // Ledger değişince gelir/gider/fark güncelle; kasa ve banka'yı koru
    useEffect(() => {
        const newSummary = monthlySummary.map(m => {
            const monthData = ledger[m.ay];
            if (!monthData || m.ay.includes("Devir")) return m;

            const totalGelir = monthData.gelirler?.reduce((s, r) => s + r.tutar, 0) || 0;
            const totalGider = monthData.giderler?.reduce((s, r) => s + r.tutar, 0) || 0;

            return {
                ...m,
                gelir: totalGelir,
                gider: totalGider,
                fark: totalGelir - totalGider
                // kasa ve banka kullanıcı override'ına bırakılır
            };
        });

        if (JSON.stringify(newSummary) !== JSON.stringify(monthlySummary)) {
            setMonthlySummary(newSummary);
        }
    }, [ledger]); // eslint-disable-line react-hooks/exhaustive-deps

    // dues.odemeler değişince ledger'ı sync et (TEK KAYNAK: dues)
    // Bu, DuesSchedule veya OperatingLedger'dan yapılan tüm değişikliklerin
    // ledger'a yansımasını garanti eder.
    useEffect(() => {
        setLedger(prevLedger => {
            let updated = { ...prevLedger };
            MONTHS.forEach(month => {
                const monthData = updated[month] || { giderler: [], gelirler: [] };
                // Mevcut aidat tag'li kayıtları temizle
                const nonAidatGelirler = (monthData.gelirler || []).filter(
                    r => !String(r.aciklama).startsWith('aidat_dues_')
                );
                // dues'tan yeni aidat kayıtlarını oluştur
                const aidatGelirler: any[] = [];
                let maxId = nonAidatGelirler.length > 0 ? Math.max(...nonAidatGelirler.map(r => r.id)) : 0;
                dues.forEach(due => {
                    const amount = due.odemeler?.[month] || 0;
                    if (amount > 0) {
                        maxId += 1;
                        const apt = apartments.find(a => a.daireNo === due.daireNo);
                        aidatGelirler.push({
                            id: maxId,
                            tarih: '',
                            aciklama: `aidat_dues_${due.daireNo}`,
                            kategori: 'Aidat Ödemesi',
                            tutar: amount,
                            tip: 'gelir' as const,
                            ay: month,
                            sakinAdi: apt?.sakinAdi || due.sakinAdi,
                            daireNo: due.daireNo,
                            displayAciklama: `${apt?.sakinAdi || due.sakinAdi} (D:${due.daireNo}) - ${month} Aidatı`
                        });
                    }
                });
                updated = {
                    ...updated,
                    [month]: { ...monthData, gelirler: [...nonAidatGelirler, ...aidatGelirler] }
                };
            });
            // Sadece değiştiyse kaydet
            return JSON.stringify(updated) !== JSON.stringify(prevLedger) ? updated : prevLedger;
        });
    }, [dues]); // eslint-disable-line react-hooks/exhaustive-deps


    // Helper to calculate total paid and balance
    // Helper to calculate total paid and balance
    const calculateTotals = (
        daireNo: number,
        devir: number,
        payments: Record<string, number>,
        elevatorPaid: number,
        extra: Record<string, number> = {}
    ) => {
        const apt = apartments.find(a => a.daireNo === daireNo);
        const isManager = apt?.isManager || false;
        const subjectToElevator = apt?.asansorTabi || false;

        const expectedDues = isManager ? 0 : 12 * monthlyDuesAmount;
        const expectedElevator = subjectToElevator ? annualElevatorFee : 0;

        const totalPaidRegular = Object.values(payments).reduce((a, b) => a + b, 0);
        const totalPaidExtra = Object.values(extra).reduce((a, b) => a + b, 0);

        const totalPaid = totalPaidRegular + elevatorPaid + totalPaidExtra;
        // Bakiye = (Devir + Beklenen Toplam) - Ödenen
        const balance = (devir + expectedDues + expectedElevator) - totalPaid;

        return { totalPaid, balance };
    };

    // Actions
    // Yardımcı: Ledger'a aidat gelir kaydı ekle (eski kaydı önce temizle)
    const syncDuesPaymentToLedger = (
        month: string,
        daireNo: number,
        sakinAdi: string,
        amount: number
    ) => {
        const ledgerTag = `aidat_dues_${daireNo}`; // Eşsiz tag
        setLedger(prev => {
            const monthData = prev[month] || { giderler: [], gelirler: [] };
            // Önceki aynı daire kaydını temizle
            const filteredGelirler = (monthData.gelirler || []).filter(
                r => r.aciklama !== ledgerTag
            );
            if (amount <= 0) {
                // Ödeme silinmişse ledger'dan da kaldır
                return { ...prev, [month]: { ...monthData, gelirler: filteredGelirler } };
            }
            const maxId = filteredGelirler.length > 0 ? Math.max(...filteredGelirler.map(r => r.id)) : 0;
            const today = new Date().toLocaleDateString('tr-TR');
            const newEntry = {
                id: maxId + 1,
                tarih: today,
                aciklama: ledgerTag, // İzleme için gizli tag - gösterimde sakin adı kullanılır
                kategori: 'Aidat Ödemesi',
                tutar: amount,
                tip: 'gelir' as const,
                ay: month,
                sakinAdi: sakinAdi,
                daireNo: daireNo,
                displayAciklama: `${sakinAdi} (D:${daireNo}) - ${month} Aidatı`
            };
            return { ...prev, [month]: { ...monthData, gelirler: [...filteredGelirler, newEntry] } };
        });
    };

    const updateDuesPayment = (daireNo: number, month: string, amount: number) => {
        api.updateDuesPayment(daireNo, month, amount, year).catch(console.error);
        const apt = apartments.find(a => a.daireNo === daireNo);
        addLog("AIDAT_ODEME", `${apt?.sakinAdi || daireNo} - ${month}: ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo) {
                const newPayments = { ...d.odemeler, [month]: amount };
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, newPayments, d.asansorOdemesi, d.extraFees);
                return {
                    ...d,
                    odemeler: newPayments,
                    toplamOdenen: totalPaid,
                    odenecekToplamBorc: balance
                };
            }
            return d;
        }));
        // Ledger sync useEffect([dues]) tarafından otomatik yapılır
    };

    const updateExtraFee = (daireNo: number, column: string, amount: number) => {
        api.updateExtraFee(daireNo, column, amount, year).catch(console.error);
        addLog("EK_UCRET_ODEME", `Daire ${daireNo} - ${column}: ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo) {
                const newExtra = { ...(d.extraFees || {}), [column]: amount };
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, d.odemeler, d.asansorOdemesi, newExtra);
                return {
                    ...d,
                    extraFees: newExtra,
                    odenecekToplamBorc: balance,
                    toplamOdenen: totalPaid
                };
            }
            return d;
        }));
    };

    const updateElevatorPayment = (daireNo: number, amount: number) => {
        api.updateElevatorPayment(daireNo, amount, year).catch(console.error);
        addLog("ASANSOR_ODEME", `Daire ${daireNo}: ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo) {
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, d.odemeler, amount, d.extraFees);
                return {
                    ...d,
                    asansorOdemesi: amount,
                    toplamOdenen: totalPaid,
                    odenecekToplamBorc: balance
                };
            }
            return d;
        }));
    };

    const updateApartment = (daireNo: number, data: Partial<Apartment>) => {
        api.updateApartment(daireNo, data).catch(console.error);
        setApartments(prev => prev.map(apt => apt.daireNo === daireNo ? { ...apt, ...data } : apt));
    };

    const addApartment = async (apt: Apartment) => {
        api.createApartment({ ...apt }, buildingId).catch(console.error);
        setApartments(prev => [...prev, apt]);
        setDues(prev => [...prev, {
            daireNo: apt.daireNo,
            sakinAdi: apt.sakinAdi,
            devredenBorc2024: 0,
            odemeler: {},
            extraFees: {},
            asansorOdemesi: 0,
            toplamOdenen: 0,
            borc: 0,
            gecikmeCezasi: 0,
            odenecekToplamBorc: 0
        }]);

        // Log kaydı
        addLog("DAIRE_EKLE", `Daire ${apt.daireNo} eklendi — Sakin: ${apt.sakinAdi}`);

        // Tek RPC ile: daire oluştur + erişim kodu üret + users'a resident ekle
        generateAndSaveAccessCode(apt.daireNo, apt.sakinAdi)
            .then(code => {
                setApartments(prev => prev.map(a =>
                    a.daireNo === apt.daireNo ? { ...a, accessCode: code } : a
                ));
                toast.success(
                    `Daire ${apt.daireNo} eklendi. Erişim kodu: ${code}`,
                    { duration: 8000 }
                );
            })
            .catch(err => {
                console.error('Erişim kodu oluşturma hatası:', err);
                toast.success(`Daire ${apt.daireNo} eklendi.`);
            });
    };

    // YENİ: Aylık aidat tutarını güncelle
    const updateMonthlyDuesAmount = (amount: number) => {
        setMonthlyDuesAmount(amount);
        toast.success(`Aylık aidat tutarı ${amount} TL olarak güncellendi.`);
    };

    const updateMonthlySummaryRow = (ay: string, field: string, value: number) => {
        setMonthlySummary(prev => prev.map(m =>
            m.ay === ay ? { ...m, [field]: value } : m
        ));
    };

    const updateAnnualElevatorFee = (amount: number) => {
        setAnnualElevatorFee(amount);
        toast.success(`Yıllık Asansör aidatı ${amount} TL olarak güncellendi.`);
    };



    const deleteApartment = (daireNo: number) => {
        if (confirm(`Daire ${daireNo} silinecek. Emin misiniz?`)) {
            api.deleteApartment(daireNo).catch(console.error);
            const apt = apartments.find(a => a.daireNo === daireNo);
            setApartments(prev => prev.filter(a => a.daireNo !== daireNo));
            setDues(prev => prev.filter(d => d.daireNo !== daireNo));
            addLog("DAIRE_SIL", `Daire ${daireNo} silindi — Sakin: ${apt?.sakinAdi || 'Bilinmiyor'}`);
            toast.success(`Daire ${daireNo} silindi.`);
        }
    };

    const updateStaffInfo = (name: string, role: string) => {
        setStaffName(name);
        setStaffRole(role);
        toast.success("Personel bilgileri güncellendi.");
    };

    const updateStaffRecord = (month: string, data: Partial<StaffRecord>) => {
        api.updateStaffRecord(month, data, buildingId).catch(console.error);
        setStaffRecords(prev => {
            const updated = prev.map(rec => rec.ay === month ? { ...rec, ...data } : rec);

            // Sync with Ledger: if toplamOdenen changed, add/update expense in ledger
            if (data.toplamOdenen !== undefined) {
                const amount = data.toplamOdenen;
                const ledgerTag = `staff_payment_${month}`;

                setLedger(prevLedger => {
                    const monthData = prevLedger[month] || { giderler: [], gelirler: [] };
                    const filteredGiderler = (monthData.giderler || []).filter(r => r.aciklama !== ledgerTag);

                    if (amount > 0) {
                        const maxId = filteredGiderler.length > 0 ? Math.max(...filteredGiderler.map(r => r.id)) : 0;
                        const newEntry = {
                            id: maxId + 1,
                            tarih: new Date().toLocaleDateString('tr-TR'),
                            aciklama: ledgerTag,
                            kategori: 'Kapıcı Aylık',
                            tutar: amount,
                            tip: 'gider' as const,
                            ay: month,
                            displayAciklama: `${month} Ayı Personel Ödemesi (${staffName})`
                        };
                        return { ...prevLedger, [month]: { ...monthData, giderler: [...filteredGiderler, newEntry] } };
                    } else {
                        return { ...prevLedger, [month]: { ...monthData, giderler: filteredGiderler } };
                    }
                });
            }

            return updated;
        });
        toast.success(`${month} dönemi personel kaydı güncellendi.`);
    };

    const addLedgerEntry = (month: string, type: 'gelir' | 'gider', entry: Omit<LedgerRow, 'id'>) => {
        api.createLedgerEntry(month, type, entry, buildingId).catch(console.error);
        addLog("ISLETME_DEFTERI_EKLE", `${month} - ${type}: ${entry.aciklama} (${entry.tutar} TL)`);
        setLedger(prev => {
            const monthData = prev[month] || { giderler: [], gelirler: [] };
            const currentList = type === 'gelir' ? monthData.gelirler : monthData.giderler;
            const maxId = currentList.length > 0 ? Math.max(...currentList.map(r => r.id)) : 0;
            const newEntry = { ...entry, id: maxId + 1 };

            const updatedMonth = {
                ...monthData,
                [type === 'gelir' ? 'gelirler' : 'giderler']: [...currentList, newEntry]
            };

            return { ...prev, [month]: updatedMonth };
        });
        toast.success("Kayıt eklendi.");
    };

    const deleteLedgerEntry = (month: string, type: 'gelir' | 'gider', id: number) => {
        api.deleteLedgerEntry(id).catch(console.error);
        addLog("ISLETME_DEFTERI_SIL", `${month} - ${type} ID: ${id}`);

        setLedger(prev => {
            const monthData = prev[month];
            if (!monthData) return prev;

            const listKey = type === 'gelir' ? 'gelirler' : 'giderler';

            // Silinecek kayıt aidat tag'li mi? Varsa aidat çizelgesini de güncelle
            if (type === 'gelir') {
                const deletedEntry = monthData.gelirler.find(r => r.id === id);
                if (deletedEntry && String(deletedEntry.aciklama).startsWith('aidat_dues_')) {
                    const daireNo = parseInt(String(deletedEntry.aciklama).replace('aidat_dues_', ''), 10);
                    if (!isNaN(daireNo)) {
                        // Dues state'ini async güncelle (setDues'ı çağır)
                        setTimeout(() => {
                            setDues(prevDues => prevDues.map(d => {
                                if (d.daireNo === daireNo) {
                                    const newOdemeler = { ...d.odemeler, [month]: 0 };
                                    return { ...d, odemeler: newOdemeler };
                                }
                                return d;
                            }));
                        }, 0);
                    }
                }
            }

            const updatedList = monthData[listKey].filter(r => r.id !== id);
            return { ...prev, [month]: { ...monthData, [listKey]: updatedList } };
        });
        toast.success("Kayıt silindi.");
    };

    const addDuesColumn = (name: string) => {
        if (!duesColumns.includes(name)) {
            api.createDuesColumn(name, buildingId).catch(console.error);
            setDuesColumns(prev => [...prev, name]);
            toast.success(`${name} sütunu eklendi.`);
        }
    };

    const removeDuesColumn = (name: string) => {
        if (confirm(`${name} sütunu silinecek. Emin misiniz?`)) {
            api.deleteDuesColumn(name).catch(console.error);
            setDuesColumns(prev => prev.filter(c => c !== name));
            toast.success(`${name} sütunu silindi.`);
        }
    };

    // Helper: Save current data to archival storage
    const saveCurrentYearData = () => {
        const data: AppData = { dues, ledger, monthlySummary, staffRecords, apartments, duesColumns };
        localStorage.setItem(`app_data_${year}`, JSON.stringify(data));
        // Ensure year is in available years
        if (!availableYears.includes(year)) {
            setAvailableYears(prev => [...prev, year].sort());
        }
        localStorage.setItem(`app_data_${year}`, JSON.stringify(data));
    };

    const startNewYear = () => {
        if (confirm(`${year + 1} yılına geçmek istediğinize emin misiniz? (Mevcut yıl verisi saklanacaktır)`)) {
            saveCurrentYearData();

            const newDues: MonthlyDues[] = dues.map(d => ({
                ...d,
                devredenBorc2024: d.odenecekToplamBorc, // Carry over balance
                odemeler: {},
                extraFees: {},
                asansorOdemesi: 0,
                toplamOdenen: 0,
                borc: 0,
                gecikmeCezasi: 0,
                odenecekToplamBorc: d.odenecekToplamBorc
            }));

            // Reset States for New Year
            setDues(newDues);
            setYear(prev => {
                const nextYear = prev + 1;
                setAvailableYears(py => [...py, nextYear].sort());
                return nextYear;
            });
            setLedger(initialLedgerData);
            setMonthlySummary(initialMonthlySummary);
            setStaffRecords(initialStaffRecords);
            // duesColumns kept? Yes usually.

            toast.success(`Yeni yıl (${year + 1}) oluşturuldu.`);
        }
    };


    const switchYear = (targetYear: number) => {
        // First save current logic state just in case
        saveCurrentYearData();

        // Load target year
        const savedData = localStorage.getItem(`app_data_${targetYear}`);
        if (savedData) {
            const data: AppData = JSON.parse(savedData);
            setYear(targetYear);
            setDues(data.dues);
            setLedger(data.ledger);
            setMonthlySummary(data.monthlySummary);
            setStaffRecords(data.staffRecords);
            setApartments(data.apartments);
            setDuesColumns(data.duesColumns || []);
            toast.success(`${targetYear} yılına geçiş yapıldı.`);
        } else {
            toast.error(`${targetYear} verisi bulunamadı.`);
        }
    }

    const updateApartmentName = (name: string) => {
        setApartmentName(name);
        toast.success("Apartman adı güncellendi.");
    };

    const updateExpenseItem = (id: number, item: Partial<ExpenseItem>) => {
        setExpenseItems(prev => prev.map(ex => ex.id === id ? { ...ex, ...item } : ex));
    };

    const addExpenseItem = (item: Omit<ExpenseItem, 'id'>) => {
        const newId = Math.max(...expenseItems.map(i => i.id), 0) + 1;
        setExpenseItems(prev => [...prev, { ...item, id: newId }]);
        toast.success("Gider kalemi eklendi.");
    };

    const removeExpenseItem = (id: number) => {
        setExpenseItems(prev => prev.filter(i => i.id !== id));
        toast.success("Gider kalemi silindi.");
    };

    const addLog = async (action: string, details: string) => {
        let userName = "Admin";
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                userName = user.email.split('@')[0]; // Use first part of email for brevity
            }
        } catch (e) {
            console.error("Auth user fetch error", e);
        }

        const newLog: LogEntry = {
            id: Date.now(),
            date: new Date().toISOString(),
            action,
            details,
            user: userName
        };
        setLogs(prev => [newLog, ...prev]);

        // Push to DB (fire and forget)
        api.addLog(action, details, userName, buildingId).catch(err => {
            // Silently fail or log to console, local state is updated anyway
            console.error("Failed to push log to DB", err);
        });
    };

    const value = {
        year,
        dues,
        apartments,
        staffRecords,
        monthlySummary,
        ledger,
        duesColumns,
        availableYears,
        monthlyDuesAmount,
        annualElevatorFee, // YENİ
        currentMonthIndex,
        apartmentName, // YENİ
        expenseItems, // YENİ
        logs, // YENİ
        addLog, // YENİ
        updateDuesPayment,
        updateExtraFee,
        updateElevatorPayment,
        updateApartment,
        addApartment,
        deleteApartment,
        staffName,
        staffRole,
        updateStaffInfo,
        updateStaffRecord,
        addLedgerEntry,
        deleteLedgerEntry,
        addDuesColumn,
        removeDuesColumn,
        updateMonthlyDuesAmount,
        updateMonthlySummaryRow, // YENİ
        updateAnnualElevatorFee, // YENİ
        startNewYear,
        switchYear,
        updateApartmentName, // YENİ
        updateExpenseItem, // YENİ
        addExpenseItem, // YENİ
        removeExpenseItem // YENİ
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
};
