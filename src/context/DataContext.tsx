
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

export interface Announcement {
    id: string;
    message: string;
    date: string;
}

interface AppData {
    dues: MonthlyDues[];
    ledger: LedgerParams;
    monthlySummary: MonthlySummary[];
    staffRecords: StaffRecord[];
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
    duesColumnFees: Record<string, number>;
    availableYears: number[];
    monthlyDuesAmount: number;
    currentMonthIndex: number;
    apartmentName: string;
    annualElevatorFee: number;
    expenseItems: ExpenseItem[];
    logs: LogEntry[];
    staffName: string;
    staffRole: string;
    isLoading: boolean;
    announcements: Announcement[];

    // Actions
    addLog: (action: string, details: string) => void;
    updateApartmentName: (name: string) => void;
    updateStaffInfo: (name: string, role: string) => void;
    updateExpenseItem: (id: number, item: Partial<ExpenseItem>) => void;
    updateDuesPayment: (daireNo: number, month: string, amount: number, blok?: string) => void;
    updateExtraFee: (daireNo: number, column: string, amount: number, blok?: string) => void;
    updateElevatorPayment: (daireNo: number, amount: number, blok?: string) => void;
    updateAnnualElevatorFee: (amount: number) => void;
    updateApartment: (daireNo: number, data: Partial<Apartment>, oldBlock?: string) => void;
    addExpenseItem: (item: Omit<ExpenseItem, 'id'>) => void;
    removeExpenseItem: (id: number) => void;
    addApartment: (apt: Apartment) => void;
    deleteApartment: (daireNo: number, blok?: string) => void;
    updateStaffRecord: (month: string, data: Partial<StaffRecord>) => void;
    addLedgerEntry: (month: string, type: 'gelir' | 'gider', entry: Omit<LedgerRow, 'id'>) => void;
    deleteLedgerEntry: (month: string, type: 'gelir' | 'gider', id: number) => void;
    addDuesColumn: (name: string, fee?: number) => void;
    removeDuesColumn: (name: string) => void;
    updateDuesColumnFee: (name: string, fee: number) => void;
    updateMonthlyDuesAmount: (amount: number) => void;
    updateMonthlySummaryRow: (ay: string, field: string, value: number) => void;
    updateDevir: (daireNo: number, amount: number, blok?: string) => void;
    importDuesData: (data: { daireNo: number; sakinAdi?: string; devir?: number; odemeler?: Record<string, number>; asansor?: number; extraFees?: Record<string, number> }[]) => void;
    startNewYear: () => void;
    switchYear: (targetYear: number) => void;
    isDbAvailable: boolean;
    retryRemoteData: () => Promise<void>;
    refreshData: (silent?: boolean) => Promise<void>;
    addAnnouncement: (message: string) => void;
    deleteAnnouncement: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Building-scoped localStorage key helper - reactive state so re-fetch fires on login
    const [buildingId, setBuildingId] = useState<string>(
        () => localStorage.getItem("selectedBuildingId") || "default"
    );
    const bKey = (key: string) => `b_${buildingId}_${key}`;

    // Farklı cihazdan giriş sonrası selectedBuildingId set edildiğinde algıla
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "selectedBuildingId" && e.newValue && e.newValue !== buildingId) {
                setBuildingId(e.newValue);
            }
        };
        // Aynı sekme içindeki değişiklikler için polling (localStorage event yalnızca diğer sekmelere gider)
        const interval = setInterval(() => {
            const current = localStorage.getItem("selectedBuildingId") || "default";
            if (current !== buildingId) {
                setBuildingId(current);
            }
        }, 500);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("storage", handleStorage);
            clearInterval(interval);
        };
    }, [buildingId]);

    // Loading state - DB'den veri çekilene kadar true
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDbAvailable, setIsDbAvailable] = useState(true);
    const initialLoadDone = useRef(false);

    // Current Year State
    const [year, setYear] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_year"));
        return saved ? parseInt(saved) : new Date().getFullYear();
    });

    // We keep "Active" state for immediate binding - localStorage is cache only
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

    // Sütun ücretleri
    const [duesColumnFees, setDuesColumnFees] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem(bKey("app_duesColumnFees"));
        return saved ? JSON.parse(saved) : {};
    });

    // Aylık aidat tutarı
    const [monthlyDuesAmount, setMonthlyDuesAmount] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_monthlyDuesAmount"));
        return saved ? parseFloat(saved) : MONTHLY_DUES;
    });

    // Mevcut ay index'i (canlı tarih)
    const currentMonthIndex = (() => {
        const now = new Date();
        return now.getMonth();
    })();

    // Apartman Adı
    const [apartmentName, setApartmentName] = useState<string>(() => {
        return localStorage.getItem(bKey("app_apartmentName")) || "Apartman";
    });

    // Aylık Asansör Ücreti (unused but kept for compat)
    const [monthlyElevatorFee, setMonthlyElevatorFee] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_monthlyElevatorFee"));
        return saved ? parseFloat(saved) : 50;
    });

    // Gider Kalemleri
    const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(() => {
        const saved = localStorage.getItem(bKey("app_expenseItems"));
        if (saved) return JSON.parse(saved);

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

    // Loglar
    const [logs, setLogs] = useState<LogEntry[]>(() => {
        const saved = localStorage.getItem(bKey("app_logs"));
        return saved ? JSON.parse(saved) : [];
    });

    // Personel Bilgileri
    const [staffName, setStaffName] = useState<string>(() => {
        return localStorage.getItem(bKey("app_staffName")) || "Belirtilmemiş";
    });
    const [staffRole, setStaffRole] = useState<string>(() => {
        return localStorage.getItem(bKey("app_staffRole")) || "Personel";
    });

    // Store available years
    const [availableYears, setAvailableYears] = useState<number[]>(() => {
        const saved = localStorage.getItem(bKey("app_available_years"));
        return saved ? JSON.parse(saved) : [new Date().getFullYear()];
    });

    // Annual Elevator Fee State
    const [annualElevatorFee, setAnnualElevatorFee] = useState<number>(() => {
        const saved = localStorage.getItem(bKey("app_annualElevatorFee"));
        return saved ? parseFloat(saved) : 600;
    });

    const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
        const saved = localStorage.getItem(bKey("app_announcements"));
        return saved ? JSON.parse(saved) : [];
    });

    // ===== localStorage Persistence (cache) =====
    useEffect(() => { localStorage.setItem(bKey("app_staffName"), staffName); }, [staffName]);
    useEffect(() => { localStorage.setItem(bKey("app_staffRole"), staffRole); }, [staffRole]);
    useEffect(() => { localStorage.setItem(bKey("app_apartmentName"), apartmentName); }, [apartmentName]);
    useEffect(() => { localStorage.setItem(bKey("app_expenseItems"), JSON.stringify(expenseItems)); }, [expenseItems]);
    useEffect(() => { localStorage.setItem(bKey("app_announcements"), JSON.stringify(announcements)); }, [announcements]);
    useEffect(() => { localStorage.setItem(bKey("app_logs"), JSON.stringify(logs)); }, [logs]);
    useEffect(() => { localStorage.setItem(bKey("app_year"), year.toString()); }, [year]);
    useEffect(() => { localStorage.setItem(bKey("app_dues"), JSON.stringify(dues)); }, [dues]);
    useEffect(() => { localStorage.setItem(bKey("app_apartments"), JSON.stringify(apartments)); }, [apartments]);
    useEffect(() => { localStorage.setItem(bKey("app_staffRecords"), JSON.stringify(staffRecords)); }, [staffRecords]);
    useEffect(() => { localStorage.setItem(bKey("app_monthlySummary"), JSON.stringify(monthlySummary)); }, [monthlySummary]);
    useEffect(() => { localStorage.setItem(bKey("app_ledger"), JSON.stringify(ledger)); }, [ledger]);
    useEffect(() => { localStorage.setItem(bKey("app_duesColumns"), JSON.stringify(duesColumns)); }, [duesColumns]);
    useEffect(() => { localStorage.setItem(bKey("app_monthlyDuesAmount"), monthlyDuesAmount.toString()); }, [monthlyDuesAmount]);
    useEffect(() => { localStorage.setItem(bKey("app_annualElevatorFee"), annualElevatorFee.toString()); }, [annualElevatorFee]);
    useEffect(() => { localStorage.setItem(bKey("app_available_years"), JSON.stringify(availableYears)); }, [availableYears]);

    // DB bağlantı durumu - false ise hiçbir save yapılmaz
    const dbConnected = useRef(true);
    // Tablolar mevcut mu tracking
    const dbTablesAvailable = useRef<Record<string, boolean>>({ monthly_summary: true, expense_items: true });

    // ===== DB'den Veri Çekme (DB-first approach) =====
    const refreshData = useCallback(async (silent = false) => {
        if (!buildingId || buildingId === 'default') {
            setIsLoading(false);
            return;
        }

        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            // 1) Önce DB bağlantısını kontrol et (tek bir istek)
            const dbOk = await api.waitForDb();
            setIsDbAvailable(dbOk);
            if (!dbOk) {
                dbConnected.current = false;
                console.warn('[DB] Supabase erişilemez - sadece localStorage kullanılacak');
                setIsLoading(false);
                initialLoadDone.current = true;
                return;
            }

            dbConnected.current = true;

            // 2) DB bağlantısı var, TÜM verileri PARALEL çek (çok daha hızlı)
            const [
                remoteSettings,
                remoteApts,
                remoteDues,
                remoteCols,
                remoteStaff,
                remoteLogs,
                remoteSummary,
                remoteExpenseItems,
                allLedgerEntries
            ] = await Promise.all([
                api.fetchBuildingSettings(buildingId).catch(() => ({} as api.BuildingSettings)),
                api.fetchApartments(buildingId).catch(() => null),
                api.fetchDues(year).catch(() => null),
                api.fetchDuesColumns(buildingId).catch(() => null),
                api.fetchStaffRecords(buildingId).catch(() => null),
                api.fetchLogs(buildingId).catch(() => null),
                api.fetchMonthlySummary(buildingId, year).catch(() => { dbTablesAvailable.current.monthly_summary = false; return null; }),
                api.fetchExpenseItems(buildingId).catch(() => { dbTablesAvailable.current.expense_items = false; return null; }),
                api.fetchAllLedgerEntries(buildingId).catch(() => ({} as Record<string, any>)),
            ]);

            // 3) Apartments - DB'den gelirse DB verisini kullan
            if (remoteApts && remoteApts.length > 0) {
                setApartments(remoteApts);
            }

            // 4) Dues - DB'den gelirse DB verisini kullan
            if (remoteDues && remoteDues.length > 0) {
                setDues(remoteDues);
            }

            // 5) Dues Columns
            if (remoteCols) {
                setDuesColumns(remoteCols);
            }

            // 6) Staff Records
            if (remoteStaff && remoteStaff.length > 0) {
                setStaffRecords(remoteStaff);
            }

            // 7) Ledger entries - zaten paralel çekildi, sadece işle
            const newLedger = { ...initialLedgerData };
            if (allLedgerEntries && Object.keys(allLedgerEntries).length > 0) {
                const fixEntries = (rows: any[], month: string) => rows.map(r => ({
                    ...r,
                    displayAciklama: r.displayAciklama && !r.displayAciklama.startsWith('aidat_dues_')
                        ? r.displayAciklama
                        : r.aciklama.startsWith('aidat_dues_')
                            ? `${r.sakinAdi || 'Daire ' + r.daireNo} (D:${r.daireNo || r.aciklama.replace('aidat_dues_', '')}) - ${month} Aidatı`
                            : r.aciklama.startsWith('devir_from_')
                                ? `${r.aciklama.replace('devir_from_', '')} ayından devir`
                                : r.displayAciklama || r.aciklama,
                }));
                for (const month of MONTHS) {
                    const entries = allLedgerEntries[month];
                    if (entries && (entries.gelirler.length > 0 || entries.giderler.length > 0)) {
                        newLedger[month] = {
                            gelirler: fixEntries(entries.gelirler, month),
                            giderler: fixEntries(entries.giderler, month),
                        };
                    }
                }
            }
            setLedger(newLedger);

            // 7) Logs
            if (remoteLogs) {
                setLogs(remoteLogs.map(l => ({
                    id: l.id,
                    date: l.created_at,
                    action: l.action,
                    details: l.details,
                    user: l.user
                })));
            }

            // 8) Building Settings - DB'den gelen ayarları uygula
            if (remoteSettings) {
                if (remoteSettings.apartmentName) setApartmentName(remoteSettings.apartmentName);
                if (remoteSettings.monthlyDuesAmount !== undefined && !isNaN(remoteSettings.monthlyDuesAmount)) {
                    setMonthlyDuesAmount(remoteSettings.monthlyDuesAmount);
                }
                if (remoteSettings.annualElevatorFee !== undefined && !isNaN(remoteSettings.annualElevatorFee)) {
                    setAnnualElevatorFee(remoteSettings.annualElevatorFee);
                }
                if (remoteSettings.staffName) setStaffName(remoteSettings.staffName);
                if (remoteSettings.staffRole) setStaffRole(remoteSettings.staffRole);
                if (remoteSettings.availableYears && remoteSettings.availableYears.length > 0) {
                    setAvailableYears(remoteSettings.availableYears);
                }
                if (remoteSettings.currentYear && !isNaN(remoteSettings.currentYear)) {
                    setYear(remoteSettings.currentYear);
                }
                if ((remoteSettings as any).duesColumnFees) {
                    setDuesColumnFees((remoteSettings as any).duesColumnFees);
                }
                if ((remoteSettings as any).announcements) {
                    setAnnouncements((remoteSettings as any).announcements);
                }
            }

            // 9) Monthly Summary - DB'den gelirse DB verisini kullan
            if (remoteSummary && remoteSummary.length > 0) {
                setMonthlySummary(prev => {
                    return prev.map(m => {
                        const remote = remoteSummary.find(r => r.month_name === m.ay);
                        if (remote) {
                            return {
                                ay: m.ay,
                                gelir: remote.gelir,
                                gider: remote.gider,
                                asansor: remote.asansor,
                                kasa: remote.kasa,
                                banka: remote.banka,
                                fark: remote.fark,
                            };
                        }
                        return m;
                    });
                });
            }

            // 10) Expense Items - DB'den gelirse DB verisini kullan
            if (remoteExpenseItems && remoteExpenseItems.length > 0) {
                setExpenseItems(remoteExpenseItems.map((item, idx) => ({
                    id: item.id,
                    description: item.description,
                    amount: item.amount,
                    quantity: item.quantity,
                    unit: item.unit,
                })));
            }

        } catch (err) {
            console.error("Data refresh error", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            initialLoadDone.current = true;
        }
    }, [buildingId, year]);

    useEffect(() => {
        refreshData();
    }, [refreshData, buildingId, year]);

    // Otomatik Yenileme: Sayfa odaklandığında ve her 60 saniyede bir
    useEffect(() => {
        if (!buildingId || buildingId === 'default') return;

        // 1) Periyodik yenileme (60 saniye)
        const interval = setInterval(() => {
            console.log("[DataContext] Auto-refreshing data...");
            refreshData(true);
        }, 60000);

        // 2) Focus yenileme (Tab'a geri dönüldüğünde)
        const handleFocus = () => {
            console.log("[DataContext] Tab focused, refreshing data...");
            refreshData(true);
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [refreshData, buildingId]);

    // initialLoadDone olunca mevcut aidat ödemelerini ledger_entries'e sync et (tek seferlik migration)
    const ledgerSyncDoneRef = useRef(false);
    useEffect(() => {
        if (isLoading) return; // loadRemote henüz bitmedi
        if (ledgerSyncDoneRef.current) return;
        if (!buildingId || buildingId === 'default') return;
        if (!api.isDbAvailable()) return;
        
        // Sakin girişi yapılmışsa, veritabanına yazma işlemi (migration) yapma
        if (localStorage.getItem('residentSession')) return;

        // Zaten ledger'da aidat_dues kayıtları varsa sync gerekmez
        const hasAnyAidat = MONTHS.some(m =>
            (ledger[m]?.gelirler || []).some(r => String(r.aciklama).startsWith('aidat_dues_'))
        );

        // Aidat ödemesi olan ama ledger'da karşılığı olmayan daireler var mı?
        const hasUnsynced = dues.some(due =>
            MONTHS.some(month => {
                const amount = due.odemeler?.[month] || 0;
                if (amount <= 0) return false;
                // ledger'da bu aidat kaydı var mı?
                const monthGelirler = ledger[month]?.gelirler || [];
                const blockSuffix = due.blok ? `_${due.blok}` : '';
                return !monthGelirler.some(r => String(r.aciklama) === `aidat_dues_${due.daireNo}${blockSuffix}`);
            })
        );

        if (hasAnyAidat && !hasUnsynced) {
            ledgerSyncDoneRef.current = true;
            return;
        }

        // Mevcut tüm aidat ödemelerini ledger_entries tablosuna yaz (migration)
        ledgerSyncDoneRef.current = true;
        const effectiveBuildingId = buildingId !== 'default' ? buildingId : undefined;
        console.log('[DB] Syncing dues to ledger_entries (migration)...');
        dues.forEach(due => {
            MONTHS.forEach(month => {
                const amount = due.odemeler?.[month] || 0;
                if (amount > 0) {
                    const apt = apartments.find(a => a.daireNo === due.daireNo && a.blok === due.blok);
                    const sakinAdi = apt?.sakinAdi || due.sakinAdi || String(due.daireNo);
                    api.upsertLedgerAidatEntry(month, due.daireNo, sakinAdi, amount, effectiveBuildingId, due.blok).catch((err) => {
                        console.warn('[DB] upsertLedgerAidatEntry error:', err);
                    });
                }
            });
        });
    }, [isLoading, dues, ledger]); // isLoading false'a dönünce ve dues + ledger güncellenince tetiklenir

    const retryRemoteData = async () => {
        api.resetDbStatus();
        window.location.reload();
    };

    // ===== Settings değiştiğinde DB'ye kaydet =====
    // KRİTİK: Veriler gerçekten dolmadan (isLoading) veya DB bağlı değilse DB'yi EZME!
    const canSaveToDB = () => !isLoading && initialLoadDone.current && buildingId !== 'default' && dbConnected.current;

    useEffect(() => {
        if (!canSaveToDB()) return;

        api.saveBuildingSetting(buildingId, 'apartmentName', apartmentName).catch(() => { });
    }, [apartmentName]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'monthlyDuesAmount', monthlyDuesAmount).catch(() => { });
    }, [monthlyDuesAmount]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'annualElevatorFee', annualElevatorFee).catch(() => { });
    }, [annualElevatorFee]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'staffName', staffName).catch(() => { });
    }, [staffName]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'staffRole', staffRole).catch(() => { });
    }, [staffRole]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'availableYears', availableYears).catch(() => { });
    }, [availableYears]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'announcements', announcements).catch(() => { });
    }, [announcements]);

    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'currentYear', year).catch(() => { });
    }, [year]);

    // Monthly Summary değiştiğinde DB'ye kaydet (tablo mevcutsa)
    useEffect(() => {
        if (isLoading || !canSaveToDB() || !dbTablesAvailable.current.monthly_summary) return;

        // Sadece GELİR veya GİDER gerçekten hesaplanmışsa (0'dan farklıysa veya 0 olarak teyit edilmişse) kaydet
        monthlySummary.forEach(m => {
            // "Devir" satırlarını kaydetme, onlar manuel girilmez
            if (m.ay === 'Devir') return;

            api.saveMonthlySummaryRow(buildingId, year, m.ay, {
                gelir: m.gelir,
                gider: m.gider,
                asansor: m.asansor || 0,
                kasa: m.kasa || 0,
                banka: m.banka || 0,
                fark: m.fark,
            }).catch(() => { dbTablesAvailable.current.monthly_summary = false; });
        });
    }, [monthlySummary, buildingId, year]);

    // Ledger değişince gelir/gider/fark/kasa güncelle; banka'yı koru (manuel override varsa)
    useEffect(() => {
        if (isLoading) return; // Veri yüklenirken hesaplama yapma

        // Devir bakiyesini bul
        const devirRow = monthlySummary.find(m => m.ay === 'Devir');
        const devirGelir = devirRow ? devirRow.gelir : 0;
        let cumulativeKasa = devirGelir;

        const newSummary = monthlySummary.map(m => {
            const monthData = ledger[m.ay];
            if (!monthData || m.ay.includes("Devir")) return m;

            const totalGelir = monthData.gelirler?.reduce((s, r) => s + r.tutar, 0) || 0;
            const totalGider = monthData.giderler?.reduce((s, r) => s + r.tutar, 0) || 0;
            const fark = totalGelir - totalGider;
            cumulativeKasa += fark;

            // Banka: kullanıcı manuel override yapmışsa koru, yoksa kasa ile aynı yap
            const hasBankaOverride = m.banka !== undefined && m.banka !== 0 && m.banka !== m.kasa;
            const newBanka = hasBankaOverride ? m.banka : cumulativeKasa;

            return {
                ...m,
                gelir: totalGelir,
                gider: totalGider,
                fark,
                kasa: cumulativeKasa,
                banka: newBanka,
            };
        });

        if (JSON.stringify(newSummary) !== JSON.stringify(monthlySummary)) {
            setMonthlySummary(newSummary);
        }
    }, [ledger]); // eslint-disable-line react-hooks/exhaustive-deps

    // dues.odemeler değişince ledger'ı sync et (TEK KAYNAK: dues)
    useEffect(() => {
        if (isLoading) return; // Veri yüklenirken sync yapma

        setLedger(prevLedger => {
            let updated = { ...prevLedger };
            MONTHS.forEach(month => {
                const monthData = updated[month] || { giderler: [], gelirler: [] };
                const nonAidatGelirler = (monthData.gelirler || []).filter(
                    r => !String(r.aciklama).startsWith('aidat_dues_')
                );
                const aidatGelirler: any[] = [];
                let maxId = nonAidatGelirler.length > 0 ? Math.max(...nonAidatGelirler.map(r => r.id)) : 0;
                dues.forEach(due => {
                    const amount = due.odemeler?.[month] || 0;
                    if (amount > 0) {
                        maxId += 1;
                        const apt = apartments.find(a => a.daireNo === due.daireNo && a.blok === due.blok);
                        const ledgerTag = `aidat_dues_${due.daireNo}_${due.blok || ''}`;
                        aidatGelirler.push({
                            id: maxId,
                            tarih: '',
                            aciklama: ledgerTag,
                            kategori: 'Aidat Ödemesi',
                            tutar: amount,
                            tip: 'gelir' as const,
                            ay: month,
                            sakinAdi: apt?.sakinAdi || due.sakinAdi,
                            daireNo: due.daireNo,
                            blok: due.blok,
                            displayAciklama: `${apt?.sakinAdi || due.sakinAdi} (D:${due.daireNo}${due.blok ? ` ${due.blok}` : ''}) - ${month} Aidatı`
                        });
                    }
                });
                updated = {
                    ...updated,
                    [month]: { ...monthData, gelirler: [...nonAidatGelirler, ...aidatGelirler] }
                };
            });
            return JSON.stringify(updated) !== JSON.stringify(prevLedger) ? updated : prevLedger;
        });
    }, [dues]); // eslint-disable-line react-hooks/exhaustive-deps


    // Helper to calculate total paid and balance
    const calculateTotals = (
        daireNo: number,
        devir: number,
        payments: Record<string, number>,
        elevatorPaid: number,
        extra: Record<string, number> = {},
        blok?: string
    ) => {
        const apt = apartments.find(a => a.daireNo === daireNo && (blok === undefined || a.blok === blok));
        const isManager = apt?.isManager || false;
        const subjectToElevator = apt?.asansorTabi || false;

        const expectedDues = isManager ? 0 : 12 * monthlyDuesAmount;
        const expectedElevator = subjectToElevator ? annualElevatorFee : 0;

        const totalPaidRegular = Object.values(payments).reduce((a, b) => a + b, 0);
        const totalPaidExtra = Object.values(extra).reduce((a, b) => a + b, 0);

        const totalPaid = totalPaidRegular + elevatorPaid + totalPaidExtra;
        const balance = (devir + expectedDues + expectedElevator) - totalPaid;

        return { totalPaid, balance };
    };

    // Actions
    const syncDuesPaymentToLedger = (
        month: string,
        daireNo: number,
        sakinAdi: string,
        amount: number,
        blok?: string
    ) => {
        const ledgerTag = `aidat_dues_${daireNo}_${blok || ''}`;
        setLedger(prev => {
            const monthData = prev[month] || { giderler: [], gelirler: [] };
            const filteredGelirler = (monthData.gelirler || []).filter(
                r => r.aciklama !== ledgerTag
            );
            if (amount <= 0) {
                return { ...prev, [month]: { ...monthData, gelirler: filteredGelirler } };
            }
            const maxId = filteredGelirler.length > 0 ? Math.max(...filteredGelirler.map(r => r.id)) : 0;
            const today = new Date().toLocaleDateString('tr-TR');
            const newEntry = {
                id: maxId + 1,
                tarih: today,
                aciklama: ledgerTag,
                kategori: 'Aidat Ödemesi',
                tutar: amount,
                tip: 'gelir' as const,
                ay: month,
                sakinAdi: sakinAdi,
                daireNo: daireNo,
                blok: blok,
                displayAciklama: `${sakinAdi} (D:${daireNo}${blok ? ` ${blok}` : ''}) - ${month} Aidatı`
            };
            return { ...prev, [month]: { ...monthData, gelirler: [...filteredGelirler, newEntry] } };
        });
    };

    const updateDuesPayment = (daireNo: number, month: string, amount: number, blok?: string) => {
        const apt = apartments.find(a => a.daireNo === daireNo && (blok === undefined || a.blok === blok));
        const sakinAdi = apt?.sakinAdi || String(daireNo);
        // DB'ye aidat çizelgesi kaydı
        api.updateDuesPayment(daireNo, month, amount, year, blok).catch(console.error);
        // DB'ye ledger_entries aidat kaydı (upsert)
        api.upsertLedgerAidatEntry(month, daireNo, sakinAdi, amount, buildingId !== 'default' ? buildingId : undefined, blok).catch(console.error);
        addLog("AIDAT_ODEME", `${sakinAdi} (${blok || ''}) - ${month}: ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo && (blok === undefined || d.blok === blok)) {
                const newPayments = { ...d.odemeler, [month]: amount };
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, newPayments, d.asansorOdemesi, d.extraFees, d.blok);
                return {
                    ...d,
                    odemeler: newPayments,
                    toplamOdenen: totalPaid,
                    odenecekToplamBorc: balance
                };
            }
            return d;
        }));
    };

    const updateExtraFee = (daireNo: number, column: string, amount: number, blok?: string) => {
        api.updateExtraFee(daireNo, column, amount, year, blok).catch(console.error);
        addLog("EK_UCRET_ODEME", `Daire ${daireNo} (${blok || ''}) - ${column}: ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo && (blok === undefined || d.blok === blok)) {
                const newExtra = { ...(d.extraFees || {}), [column]: amount };
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, d.odemeler, d.asansorOdemesi, newExtra, d.blok);
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

    const updateElevatorPayment = (daireNo: number, amount: number, blok?: string) => {
        api.updateElevatorPayment(daireNo, amount, year, blok).catch(console.error);
        addLog("ASANSOR_ODEME", `Daire ${daireNo} (${blok || ''}): ${amount} TL`);
        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo && (blok === undefined || d.blok === blok)) {
                const { totalPaid, balance } = calculateTotals(daireNo, d.devredenBorc2024, d.odemeler, amount, d.extraFees, d.blok);
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

    const updateApartment = (daireNo: number, data: Partial<Apartment>, oldBlock?: string) => {
        api.updateApartment(daireNo, data, oldBlock).catch(console.error);
        setApartments(prev => prev.map(apt => (apt.daireNo === daireNo && (oldBlock === undefined || apt.blok === oldBlock)) ? { ...apt, ...data } : apt));
    };

    const addApartment = async (apt: Apartment) => {
        api.createApartment({ ...apt }, buildingId).catch(console.error);
        // DaîreNo'ya göre sırala (küçük numeralı daire öne geçer)
        setApartments(prev => [...prev, apt].sort((a, b) => a.daireNo - b.daireNo));
        setDues(prev => [...prev, {
            daireNo: apt.daireNo,
            blok: apt.blok,
            sakinAdi: apt.sakinAdi,
            devredenBorc2024: 0,
            odemeler: {},
            extraFees: {},
            asansorOdemesi: 0,
            toplamOdenen: 0,
            borc: 0,
            gecikmeCezasi: 0,
            odenecekToplamBorc: 0
        }].sort((a, b) => a.daireNo - b.daireNo));

        addLog("DAIRE_EKLE", `Daire ${apt.daireNo} (${apt.blok || ''}) eklendi — Sakin: ${apt.sakinAdi}`);

        generateAndSaveAccessCode(apt.daireNo, apt.sakinAdi, apt.blok)
            .then(code => {
                setApartments(prev => prev.map(a =>
                    (a.daireNo === apt.daireNo && a.blok === apt.blok) ? { ...a, accessCode: code } : a
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



    const deleteApartment = (daireNo: number, blok?: string) => {
        if (confirm(`Daire ${daireNo} ${blok ? `(${blok} Blok) ` : ''}silinecek. Emin misiniz?`)) {
            api.deleteApartment(daireNo, blok).catch(console.error);
            const apt = apartments.find(a => a.daireNo === daireNo && (blok === undefined || a.blok === blok));
            setApartments(prev => prev.filter(a => !(a.daireNo === daireNo && (blok === undefined || a.blok === blok))));
            setDues(prev => prev.filter(d => !(d.daireNo === daireNo && (blok === undefined || d.blok === blok))));
            addLog("DAIRE_SIL", `Daire ${daireNo} (${blok || ''}) silindi — Sakin: ${apt?.sakinAdi || 'Bilinmiyor'}`);
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

            if (data.toplamOdenen !== undefined) {
                const amount = data.toplamOdenen;
                const ledgerTag = `staff_payment_${month}`;

                // Sync with DB Ledger
                // First delete existing entry with that tag to avoid duplicates in DB
                const existingInContext = ledger[month]?.giderler.find(g => g.aciklama === ledgerTag);

                const entry: Omit<LedgerRow, 'id'> = {
                    tarih: new Date().toLocaleDateString('tr-TR'),
                    aciklama: ledgerTag,
                    kategori: 'Personel Ödemesi',
                    tutar: amount,
                    tip: 'gider' as const,
                    ay: month,
                    displayAciklama: `${month} Ayı Personel Ödemesi (${staffName})`
                };

                if (existingInContext) {
                    api.deleteLedgerEntry(existingInContext.id).then(() => {
                        if (amount > 0) {
                            api.createLedgerEntry(month, 'gider', entry, buildingId).catch(console.error);
                        }
                    }).catch(console.error);
                } else if (amount > 0) {
                    api.createLedgerEntry(month, 'gider', entry, buildingId).catch(console.error);
                }

                setLedger(prevLedger => {
                    const monthData = prevLedger[month] || { giderler: [], gelirler: [] };
                    const filteredGiderler = (monthData.giderler || []).filter(r => r.aciklama !== ledgerTag);

                    if (amount > 0) {
                        const maxId = filteredGiderler.length > 0 ? Math.max(...filteredGiderler.map(r => r.id)) : 0;
                        const newEntry = {
                            id: maxId + 1,
                            tarih: new Date().toLocaleDateString('tr-TR'),
                            aciklama: ledgerTag,
                            kategori: 'Personel Ödemesi',
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

            if (type === 'gelir') {
                const deletedEntry = monthData.gelirler.find(r => r.id === id);
                if (deletedEntry && String(deletedEntry.aciklama).startsWith('aidat_dues_')) {
                    const tagParts = String(deletedEntry.aciklama).split('_');
                    const daireNo = parseInt(tagParts[2], 10);
                    const blok = tagParts[3] || '';
                    if (!isNaN(daireNo)) {
                        setTimeout(() => {
                            setDues(prevDues => prevDues.map(d => {
                                if (d.daireNo === daireNo && (d.blok === blok || (!d.blok && !blok))) {
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

    const addDuesColumn = (name: string, fee?: number) => {
        if (!duesColumns.includes(name)) {
            api.createDuesColumn(name, buildingId).catch(console.error);
            setDuesColumns(prev => [...prev, name]);
            if (fee !== undefined && fee > 0) {
                setDuesColumnFees(prev => ({ ...prev, [name]: fee }));
            }
            toast.success(`${name} sütunu eklendi.${fee ? ` (Ücret: ${fee} TL)` : ''}`);
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
                devredenBorc2024: d.odenecekToplamBorc,
                odemeler: {},
                extraFees: {},
                asansorOdemesi: 0,
                toplamOdenen: 0,
                borc: 0,
                gecikmeCezasi: 0,
                odenecekToplamBorc: d.odenecekToplamBorc
            }));

            setDues(newDues);
            setYear(prev => {
                const nextYear = prev + 1;
                setAvailableYears(py => [...py, nextYear].sort());
                return nextYear;
            });
            setLedger(initialLedgerData);
            setMonthlySummary(initialMonthlySummary);
            setStaffRecords(initialStaffRecords);

            toast.success(`Yeni yıl (${year + 1}) oluşturuldu.`);
        }
    };


    const switchYear = (targetYear: number) => {
        saveCurrentYearData();

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
        setExpenseItems(prev => {
            const updated = prev.map(ex => ex.id === id ? { ...ex, ...item } : ex);
            // DB'ye kaydet
            if (buildingId !== 'default') {
                const updatedItem = updated.find(ex => ex.id === id);
                if (updatedItem) {
                    api.saveExpenseItem(buildingId, updatedItem, updated.indexOf(updatedItem)).catch(console.error);
                }
            }
            return updated;
        });
    };

    const addExpenseItem = (item: Omit<ExpenseItem, 'id'>) => {
        const newId = Math.max(...expenseItems.map(i => i.id), 0) + 1;
        const newItem = { ...item, id: newId };
        setExpenseItems(prev => [...prev, newItem]);
        // DB'ye kaydet
        if (buildingId !== 'default') {
            api.saveExpenseItem(buildingId, item, newId).catch(console.error);
        }
        toast.success("Gider kalemi eklendi.");
    };

    const removeExpenseItem = (id: number) => {
        setExpenseItems(prev => prev.filter(i => i.id !== id));
        // DB'den sil
        if (buildingId !== 'default') {
            api.deleteExpenseItem(id).catch(console.error);
        }
        toast.success("Gider kalemi silindi.");
    };

    const addLog = async (action: string, details: string) => {
        let userName = "Admin";
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                userName = user.email.split('@')[0];
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

        api.addLog(action, details, userName, buildingId).catch(err => {
            console.error("Failed to push log to DB", err);
        });
    };

    // Devir güncelleme
    const updateDevir = (daireNo: number, amount: number, blok?: string) => {
        // DB'ye kaydet
        const apt = apartments.find(a => a.daireNo === daireNo && (blok === undefined || a.blok === blok));
        api.updateCarriedDebt(daireNo, amount, year, blok).catch(console.error);

        setDues(prev => prev.map(d => {
            if (d.daireNo === daireNo && (blok === undefined || d.blok === blok)) {
                const { totalPaid, balance } = calculateTotals(daireNo, amount, d.odemeler, d.asansorOdemesi, d.extraFees, d.blok);
                return {
                    ...d,
                    devredenBorc2024: amount,
                    toplamOdenen: totalPaid,
                    odenecekToplamBorc: balance
                };
            }
            return d;
        }));
        addLog("DEVIR_GUNCELLE", `Daire ${daireNo} (${blok || ''}): Devir ${amount} TL olarak güncellendi`);
    };

    // Excel'den veri import etme
    const importDuesData = (data: { daireNo: number; sakinAdi?: string; devir?: number; odemeler?: Record<string, number>; asansor?: number; extraFees?: Record<string, number> }[]) => {
        setDues(prev => {
            const updated = [...prev];
            data.forEach(imported => {
                const idx = updated.findIndex(d => d.daireNo === imported.daireNo);
                if (idx >= 0) {
                    const existing = updated[idx];
                    const newDevir = imported.devir !== undefined ? imported.devir : existing.devredenBorc2024;
                    const newOdemeler = imported.odemeler ? { ...existing.odemeler, ...imported.odemeler } : existing.odemeler;
                    const newAsansor = imported.asansor !== undefined ? imported.asansor : existing.asansorOdemesi;
                    const newExtra = imported.extraFees ? { ...existing.extraFees, ...imported.extraFees } : existing.extraFees;

                    const { totalPaid, balance } = calculateTotals(imported.daireNo, newDevir, newOdemeler, newAsansor, newExtra);

                    updated[idx] = {
                        ...existing,
                        sakinAdi: imported.sakinAdi || existing.sakinAdi,
                        devredenBorc2024: newDevir,
                        odemeler: newOdemeler,
                        asansorOdemesi: newAsansor,
                        extraFees: newExtra,
                        toplamOdenen: totalPaid,
                        odenecekToplamBorc: balance,
                    };
                }
            });
            return updated;
        });
        // DB'ye de sync et
        data.forEach(imported => {
            if (imported.odemeler) {
                Object.entries(imported.odemeler).forEach(([month, amount]) => {
                    api.updateDuesPayment(imported.daireNo, month, amount, year).catch(console.error);
                });
            }
            if (imported.asansor !== undefined) {
                api.updateElevatorPayment(imported.daireNo, imported.asansor, year).catch(console.error);
            }
            if (imported.extraFees) {
                Object.entries(imported.extraFees).forEach(([col, amount]) => {
                    api.updateExtraFee(imported.daireNo, col, amount, year).catch(console.error);
                });
            }
        });
        addLog("EXCEL_IMPORT", `${data.length} daire verisi Excel'den import edildi`);
        toast.success(`${data.length} daire verisi başarıyla import edildi.`);
    };

    // localStorage + DB sync for column fees
    useEffect(() => { localStorage.setItem(bKey("app_duesColumnFees"), JSON.stringify(duesColumnFees)); }, [duesColumnFees]);
    useEffect(() => {
        if (!canSaveToDB()) return;
        api.saveBuildingSetting(buildingId, 'duesColumnFees', duesColumnFees).catch(() => { });
    }, [duesColumnFees]);

    const updateDuesColumnFee = (name: string, fee: number) => {
        setDuesColumnFees(prev => ({ ...prev, [name]: fee }));
    };

    const addAnnouncement = (message: string) => {
        setAnnouncements(prev => [{ id: Date.now().toString(), message, date: new Date().toLocaleDateString('tr-TR') }, ...prev]);
        toast.success("Duyuru eklendi.");
    };

    const deleteAnnouncement = (id: string) => {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        toast.success("Duyuru silindi.");
    };

    const value = {
        year,
        dues,
        apartments,
        staffRecords,
        monthlySummary,
        ledger,
        duesColumns,
        duesColumnFees,
        availableYears,
        monthlyDuesAmount,
        annualElevatorFee,
        currentMonthIndex,
        apartmentName,
        expenseItems,
        logs,
        isLoading,
        addLog,
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
        updateDuesColumnFee,
        updateMonthlyDuesAmount,
        updateMonthlySummaryRow,
        updateAnnualElevatorFee,
        updateDevir,
        importDuesData,
        startNewYear,
        switchYear,
        updateApartmentName,
        updateExpenseItem,
        addExpenseItem,
        removeExpenseItem,
        isDbAvailable,
        retryRemoteData,
        refreshData,
        announcements,
        addAnnouncement,
        deleteAnnouncement
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
