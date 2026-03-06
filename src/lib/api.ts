import { supabase } from './supabase';
import { Apartment, MonthlyDues, LedgerRow, StaffRecord } from '@/data/initialData';

// ===== Global DB bağlantı kontrolü =====
// İlk istekte DB erişilebilir mi kontrol et, değilse tüm API çağrılarını devre dışı bırak
let _dbAvailable: boolean | null = null; // null = henüz kontrol edilmedi
let _connectionCheckPromise: Promise<boolean> | null = null;

export const resetDbStatus = () => {
    _dbAvailable = null;
    _connectionCheckPromise = null;
    console.log('[API] DB status reset requested.');
};

export const checkDbConnection = async (): Promise<boolean> => {
    if (_dbAvailable !== null) return _dbAvailable;

    // Eğer bir kontrol zaten devam ediyorsa onu bekle
    if (_connectionCheckPromise) return _connectionCheckPromise;

    _connectionCheckPromise = (async () => {
        try {
            console.log('[API] DB bağlantısı kontrol ediliyor (Dual Check)...');

            // Check building_settings and apartments - both must pass/exist
            const [settingsCheck, apartmentsCheck] = await Promise.all([
                supabase.from('building_settings').select('setting_key').limit(1),
                supabase.from('apartments').select('id').limit(1)
            ]);

            if (settingsCheck.error || apartmentsCheck.error) {
                const err = settingsCheck.error || apartmentsCheck.error;
                handleDbError(err, 'checkDbConnection');
                _dbAvailable = false;
                console.warn('[API] Supabase bağlantısı başarısız - offline mod aktif. Hata:', err?.message);
            } else {
                _dbAvailable = true;
                console.log('[API] DB bağlantısı başarılı (Building & Apartments OK).');
            }
        } catch (err) {
            _dbAvailable = false;
            console.warn('[API] Supabase erişilemez - offline mod aktif');
        } finally {
            _connectionCheckPromise = null;
        }
        return _dbAvailable || false;
    })();

    return _connectionCheckPromise;
};

/**
 * Tüm API çağrılarının başında çağrılır.
 * DB durumu bilinmiyorsa kontrolün bitmesini bekler.
 * DB kapalıysa false döner.
 */
export const waitForDb = async (): Promise<boolean> => {
    if (_dbAvailable === false) return false;
    if (_dbAvailable === true) return true;

    // Henüz kontrol edilmediyse kontrol başlat ve bitmesini bekle
    return await checkDbConnection();
};

export const isDbAvailable = () => _dbAvailable === true;

// Error helper to detect 500s or structural errors and disable DB
const handleDbError = (error: any, context: string) => {
    const is5xx = error && (error.status === 500 || (typeof error.code === 'string' && error.code.startsWith('5')));
    // 42P17 and other 42xxx are structural errors often appearing as 500s in proxy
    const isStructural = error && (typeof error.code === 'string' && error.code.startsWith('42'));

    if (is5xx || isStructural) {
        console.warn(`[API] DB ERROR (${error.code || error.status}) in ${context} - Emergency disabling DB.`);
        _dbAvailable = false;
    }
    return error;
};

// Type definitions for database entities
export interface DbApartment {
    id: number;
    apartment_number: number;
    resident_name: string;
    owner_name: string;
    has_elevator: boolean;
}

export interface DbMonthlyDues {
    id: number;
    apartment_id: number;
    year: number;
    carried_debt: number;
    elevator_payment: number;
    total_paid: number;
    balance: number;
}

export interface DbMonthlyPayment {
    id: number;
    monthly_dues_id: number;
    month: string;
    amount: number;
}

export interface DbExtraFee {
    id: number;
    monthly_dues_id: number;
    fee_name: string;
    amount: number;
}

// Apartments API
export const fetchApartments = async (buildingId?: string): Promise<Apartment[]> => {
    if (!(await waitForDb())) return [];
    let query = supabase
        .from('apartments')
        .select('*')
        .order('apartment_number');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) {
        handleDbError(error, 'fetchApartments');
        throw error;
    }

    return data.map(apt => ({
        daireNo: apt.apartment_number,
        sakinAdi: apt.resident_name,
        mulkSahibi: apt.owner_name,
        asansorTabi: apt.has_elevator,
        accessCode: apt.access_code || undefined,
    }));
};

export const createApartment = async (apartment: Omit<Apartment, 'daireNo'> & { daireNo: number }, buildingId?: string): Promise<number | null> => {
    if (!(await waitForDb())) return null;
    const insertData: any = {
        apartment_number: apartment.daireNo,
        resident_name: apartment.sakinAdi,
        owner_name: apartment.mulkSahibi,
        has_elevator: apartment.asansorTabi,
    };
    if (apartment.accessCode) insertData.access_code = apartment.accessCode;
    if (buildingId) insertData.building_id = buildingId;

    const { data, error } = await supabase
        .from('apartments')
        .insert(insertData)
        .select('id')
        .single();

    if (error) {
        handleDbError(error, 'createApartment');
        throw error;
    }
    return data?.id || null;
};

export const updateApartment = async (apartmentNumber: number, updates: Partial<Apartment>): Promise<void> => {
    if (!(await waitForDb())) return;
    const dbUpdates: any = {};
    if (updates.sakinAdi !== undefined) dbUpdates.resident_name = updates.sakinAdi;
    if (updates.mulkSahibi !== undefined) dbUpdates.owner_name = updates.mulkSahibi;
    if (updates.asansorTabi !== undefined) dbUpdates.has_elevator = updates.asansorTabi;
    if (updates.accessCode !== undefined) dbUpdates.access_code = updates.accessCode;

    const { error } = await supabase
        .from('apartments')
        .update(dbUpdates)
        .eq('apartment_number', apartmentNumber);

    if (error) {
        handleDbError(error, 'updateApartment');
        throw error;
    }
};

export const deleteApartment = async (apartmentNumber: number): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('apartment_number', apartmentNumber);

    if (error) {
        handleDbError(error, 'deleteApartment');
        throw error;
    }
};

// Dues API
export const fetchDues = async (year: number): Promise<MonthlyDues[]> => {
    if (!(await waitForDb())) return [];
    // Fetch apartments first
    const { data: apartments, error: aptError } = await supabase
        .from('apartments')
        .select('id, apartment_number, resident_name');

    if (aptError) {
        handleDbError(aptError, 'fetchDues.apartments');
        throw aptError;
    }

    // Fetch dues for the year
    const { data: dues, error: duesError } = await supabase
        .from('monthly_dues')
        .select(`
      *,
      monthly_payments (*),
      extra_fees (*)
    `)
        .eq('year', year);

    if (duesError) {
        handleDbError(duesError, 'fetchDues.dues');
        throw duesError;
    }

    // Combine data
    return apartments.map(apt => {
        const dueRecord = dues?.find(d => d.apartment_id === apt.id);

        const payments: Record<string, number> = {};
        dueRecord?.monthly_payments?.forEach((p: any) => {
            payments[p.month] = p.amount;
        });

        const extraFees: Record<string, number> = {};
        dueRecord?.extra_fees?.forEach((f: any) => {
            extraFees[f.fee_name] = f.amount;
        });

        return {
            daireNo: apt.apartment_number,
            sakinAdi: apt.resident_name,
            devredenBorc2024: dueRecord?.carried_debt || 0,
            odemeler: payments,
            extraFees,
            asansorOdemesi: dueRecord?.elevator_payment || 0,
            toplamOdenen: dueRecord?.total_paid || 0,
            borc: 0,
            gecikmeCezasi: 0,
            odenecekToplamBorc: dueRecord?.balance || 0,
        };
    });
};

export const updateDuesPayment = async (
    apartmentNumber: number,
    month: string,
    amount: number,
    year: number
): Promise<void> => {
    if (!(await waitForDb())) return;
    // Get apartment ID
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) {
        handleDbError(aptError, 'updateDuesPayment.apt');
        throw aptError;
    }

    // Get or create monthly_dues record
    let { data: duesRecord, error: duesError } = await supabase
        .from('monthly_dues')
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('year', year)
        .single();

    if (duesError && duesError.code !== 'PGRST116') {
        handleDbError(duesError, 'updateDuesPayment.dues');
        throw duesError;
    }

    if (!duesRecord) {
        const { data: newDues, error: createError } = await supabase
            .from('monthly_dues')
            .insert({ apartment_id: apt.id, year })
            .select('id')
            .single();

        if (createError) {
            handleDbError(createError, 'updateDuesPayment.create');
            throw createError;
        }
        duesRecord = newDues;
    }

    // Upsert payment
    const { error: paymentError } = await supabase
        .from('monthly_payments')
        .upsert({
            monthly_dues_id: duesRecord.id,
            month,
            amount,
        }, {
            onConflict: 'monthly_dues_id,month'
        });

    if (paymentError) {
        handleDbError(paymentError, 'updateDuesPayment.payment');
        throw paymentError;
    }

    // Recalculate totals
    await recalculateDuesTotals(duesRecord.id);
};

export const updateElevatorPayment = async (
    apartmentNumber: number,
    amount: number,
    year: number
): Promise<void> => {
    if (!(await waitForDb())) return;
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) {
        handleDbError(aptError, 'updateElevatorPayment.apt');
        throw aptError;
    }

    const { error } = await supabase
        .from('monthly_dues')
        .upsert({
            apartment_id: apt.id,
            year,
            elevator_payment: amount,
        }, {
            onConflict: 'apartment_id,year'
        });

    if (error) {
        handleDbError(error, 'updateElevatorPayment.upsert');
        throw error;
    }

    // Get the dues record ID and recalculate
    const { data: duesRecord } = await supabase
        .from('monthly_dues')
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('year', year)
        .single();

    if (duesRecord) {
        await recalculateDuesTotals(duesRecord.id);
    }
};

export const updateExtraFee = async (
    apartmentNumber: number,
    feeName: string,
    amount: number,
    year: number
): Promise<void> => {
    if (!(await waitForDb())) return;
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) {
        handleDbError(aptError, 'updateExtraFee.apt');
        throw aptError;
    }

    // Get or create monthly_dues record
    let { data: duesRecord, error: duesError } = await supabase
        .from('monthly_dues')
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('year', year)
        .single();

    if (duesError && duesError.code !== 'PGRST116') {
        handleDbError(duesError, 'updateExtraFee.duesFetch');
        throw duesError;
    }

    if (!duesRecord) {
        const { data: newDues, error: createError } = await supabase
            .from('monthly_dues')
            .insert({ apartment_id: apt.id, year })
            .select('id')
            .single();

        if (createError) {
            handleDbError(createError, 'updateExtraFee.createDues');
            throw createError;
        }
        duesRecord = newDues;
    }

    // Upsert extra fee
    const { error: feeError } = await supabase
        .from('extra_fees')
        .upsert({
            monthly_dues_id: duesRecord.id,
            fee_name: feeName,
            amount,
        }, {
            onConflict: 'monthly_dues_id,fee_name'
        });

    if (feeError) {
        handleDbError(feeError, 'updateExtraFee.feeUpsert');
        throw feeError;
    }

    await recalculateDuesTotals(duesRecord.id);
};

// Helper function to recalculate dues totals
const recalculateDuesTotals = async (duesId: number): Promise<void> => {
    if (!(await waitForDb())) return;
    const { data, error } = await supabase
        .from('monthly_dues')
        .select(`
      *,
      monthly_payments (amount),
      extra_fees (amount)
    `)
        .eq('id', duesId)
        .single();

    if (error) {
        handleDbError(error, 'recalculateDuesTotals');
        throw error;
    }

    const totalPayments = data.monthly_payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const totalExtraFees = data.extra_fees?.reduce((sum: number, f: any) => sum + f.amount, 0) || 0;
    const totalPaid = totalPayments + data.elevator_payment + totalExtraFees;

    // Expected: 12 months * monthly_dues + elevator_fee
    const MONTHLY_DUES = 750;
    const ELEVATOR_FEE = 600;
    const expected = 12 * MONTHLY_DUES + ELEVATOR_FEE;

    const balance = data.carried_debt + totalPaid - expected;

    const { error: updateError } = await supabase
        .from('monthly_dues')
        .update({
            total_paid: totalPaid,
            balance,
        })
        .eq('id', duesId);

    if (updateError) {
        handleDbError(updateError, 'recalculateDuesTotals.update');
        throw updateError;
    }
};

// Dues Columns API
export const fetchDuesColumns = async (buildingId?: string): Promise<string[]> => {
    if (!(await waitForDb())) return [];
    let query = supabase
        .from('dues_columns')
        .select('column_name')
        .order('created_at');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) {
        handleDbError(error, 'fetchDuesColumns');
        throw error;
    }
    return data.map(d => d.column_name);
};

export const createDuesColumn = async (columnName: string, buildingId?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const insertData: any = { column_name: columnName };
    if (buildingId) insertData.building_id = buildingId;

    const { error } = await supabase
        .from('dues_columns')
        .insert(insertData);

    if (error) {
        handleDbError(error, 'createDuesColumn');
        throw error;
    }
};

export const deleteDuesColumn = async (columnName: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('dues_columns')
        .delete()
        .eq('column_name', columnName);

    if (error) {
        handleDbError(error, 'deleteDuesColumn');
        throw error;
    }
};

// Ledger API
export const fetchLedgerEntries = async (month: string, buildingId?: string) => {
    if (!(await waitForDb())) return { gelirler: [], giderler: [] };
    let query = supabase
        .from('ledger_entries')
        .select('*')
        .eq('month', month)
        .order('created_at');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) {
        handleDbError(error, 'fetchLedgerEntries');
        throw error;
    }

    const gelirler: LedgerRow[] = [];
    const giderler: LedgerRow[] = [];

    data.forEach(entry => {
        const row: any = {
            id: entry.id,
            aciklama: entry.description,
            kisi: entry.person || '',
            tutar: entry.amount,
        };

        if (entry.type === 'income') {
            gelirler.push(row);
        } else {
            giderler.push(row);
        }
    });

    return { gelirler, giderler };
};

export const createLedgerEntry = async (
    month: string,
    type: 'gelir' | 'gider',
    entry: Omit<LedgerRow, 'id'>,
    buildingId?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    const insertData: any = {
        month,
        type: type === 'gelir' ? 'income' : 'expense',
        description: entry.aciklama,
        person: (entry as any).kisi || null,
        amount: entry.tutar,
    };
    if (buildingId) insertData.building_id = buildingId;

    const { error } = await supabase
        .from('ledger_entries')
        .insert(insertData);

    if (error) {
        handleDbError(error, 'createLedgerEntry');
        throw error;
    }
};

export const deleteLedgerEntry = async (id: number): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('ledger_entries')
        .delete()
        .eq('id', id);

    if (error) {
        handleDbError(error, 'deleteLedgerEntry');
        throw error;
    }
};

// Staff Records API
export const fetchStaffRecords = async (buildingId?: string): Promise<StaffRecord[]> => {
    if (!(await waitForDb())) return [];
    let query = supabase
        .from('staff_records')
        .select('*')
        .order('month');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) {
        handleDbError(error, 'fetchStaffRecords');
        throw error;
    }

    return data.map((record: any) => ({
        ay: record.month,
        maas: record.manager_salary || 0,
        mesai: 0,
        odenen: 0,
        avans: 0,
        alacak: 0,
        toplamOdenen: (record.manager_salary || 0) + (record.cleaner_salary || 0),
    }));
};

export const updateStaffRecord = async (month: string, updates: Partial<StaffRecord>, buildingId?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const dbUpdates: any = {};
    if ((updates as any).yoneticiMaasi !== undefined) dbUpdates.manager_salary = (updates as any).yoneticiMaasi;
    if ((updates as any).temizlikciMaasi !== undefined) dbUpdates.cleaner_salary = (updates as any).temizlikciMaasi;
    // Also support standard StaffRecord fields
    if (updates.maas !== undefined) dbUpdates.manager_salary = updates.maas;
    if (updates.toplamOdenen !== undefined) dbUpdates.cleaner_salary = updates.toplamOdenen;

    const upsertData: any = { month, ...dbUpdates };
    if (buildingId) upsertData.building_id = buildingId;

    const { error } = await supabase
        .from('staff_records')
        .upsert(upsertData, {
            onConflict: 'month'
        });

    if (error) {
        handleDbError(error, 'updateStaffRecord');
        throw error;
    }
};

// Logs API
export interface DbLog {
    id: number;
    action: string;
    details: string;
    created_at: string;
    user?: string;
}

export const addLog = async (action: string, details: string, user: string = "Admin", buildingId?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const insertData: any = {
        action,
        details,
        user_name: user
    };
    if (buildingId) insertData.building_id = buildingId;

    const { error } = await supabase
        .from('logs')
        .insert(insertData);

    if (error) {
        console.warn('Logging to DB failed:', error.message);
    }
};

export const fetchLogs = async (buildingId?: string): Promise<DbLog[]> => {
    if (!(await waitForDb())) return [];
    let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) {
        handleDbError(error, 'fetchLogs');
        throw error;
    }
    return data || [];
};

// ===== Building Settings API =====
export interface BuildingSettings {
    apartmentName?: string;
    monthlyDuesAmount?: number;
    annualElevatorFee?: number;
    staffName?: string;
    staffRole?: string;
    availableYears?: number[];
    currentYear?: number;
    duesColumnFees?: Record<string, number>;
}

export const fetchBuildingSettings = async (buildingId: string): Promise<BuildingSettings> => {
    if (!(await waitForDb())) return {};
    const { data, error } = await supabase
        .from('building_settings')
        .select('setting_key, setting_value')
        .eq('building_id', buildingId);

    if (error) {
        handleDbError(error, 'fetchBuildingSettings');
        console.warn('Failed to fetch building settings:', error.message);
        throw new Error(error.message);
    }

    const settings: BuildingSettings = {};
    data?.forEach((row: any) => {
        const val = row.setting_value;
        switch (row.setting_key) {
            case 'apartmentName': settings.apartmentName = val; break;
            case 'monthlyDuesAmount': settings.monthlyDuesAmount = typeof val === 'number' ? val : parseFloat(val); break;
            case 'annualElevatorFee': settings.annualElevatorFee = typeof val === 'number' ? val : parseFloat(val); break;
            case 'staffName': settings.staffName = val; break;
            case 'staffRole': settings.staffRole = val; break;
            case 'availableYears': settings.availableYears = val; break;
            case 'currentYear': settings.currentYear = typeof val === 'number' ? val : parseInt(val); break;
            case 'duesColumnFees': settings.duesColumnFees = val; break;
        }
    });
    return settings;
};

export const saveBuildingSetting = async (buildingId: string, key: string, value: any): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('building_settings')
        .upsert({
            building_id: buildingId,
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'building_id,setting_key'
        });

    if (error) {
        handleDbError(error, 'saveBuildingSetting');
        console.warn(`Failed to save building setting ${key}:`, error.message);
    }
};

// ===== Monthly Summary API =====
export interface DbMonthlySummary {
    month_name: string;
    gelir: number;
    gider: number;
    asansor: number;
    kasa: number;
    banka: number;
    fark: number;
}

export const fetchMonthlySummary = async (buildingId: string, year: number): Promise<DbMonthlySummary[] | null> => {
    if (!(await waitForDb())) return null;
    const { data, error } = await supabase
        .from('monthly_summary')
        .select('*')
        .eq('building_id', buildingId)
        .eq('year', year)
        .order('id');

    if (error) {
        handleDbError(error, 'fetchMonthlySummary');
        console.warn('Failed to fetch monthly summary:', error.message);
        throw new Error(error.message);
    }

    return data?.map((row: any) => ({
        month_name: row.month_name,
        gelir: row.gelir || 0,
        gider: row.gider || 0,
        asansor: row.asansor || 0,
        kasa: row.kasa || 0,
        banka: row.banka || 0,
        fark: row.fark || 0,
    })) || null;
};

export const saveMonthlySummaryRow = async (
    buildingId: string,
    year: number,
    monthName: string,
    data: { gelir?: number; gider?: number; asansor?: number; kasa?: number; banka?: number; fark?: number }
): Promise<void> => {
    if (!(await waitForDb())) return;
    const upsertData: any = {
        building_id: buildingId,
        year,
        month_name: monthName,
        updated_at: new Date().toISOString(),
        ...data,
    };

    const { error } = await supabase
        .from('monthly_summary')
        .upsert(upsertData, {
            onConflict: 'building_id,year,month_name'
        });

    if (error) {
        // Sessizce atla - tablo yoksa sorun yok
    }
};

// ===== Expense Items API =====
export interface DbExpenseItem {
    id: number;
    description: string;
    amount: number;
    quantity: number;
    unit: string;
}

export const fetchExpenseItems = async (buildingId: string): Promise<DbExpenseItem[] | null> => {
    if (!(await waitForDb())) return null;
    const { data, error } = await supabase
        .from('expense_items')
        .select('*')
        .eq('building_id', buildingId)
        .order('sort_order');

    if (error) {
        handleDbError(error, 'fetchExpenseItems');
        console.warn('Failed to fetch expense items:', error.message);
        throw new Error(error.message);
    }

    return data?.map((row: any) => ({
        id: row.id,
        description: row.description,
        amount: row.amount || 0,
        quantity: row.quantity || 1,
        unit: row.unit || 'TL',
    })) || null;
};

export const saveExpenseItem = async (
    buildingId: string,
    item: { description: string; amount: number; quantity: number; unit: string },
    sortOrder: number = 0
): Promise<number | null> => {
    if (!(await waitForDb())) return null;
    const { data, error } = await supabase
        .from('expense_items')
        .upsert({
            building_id: buildingId,
            description: item.description,
            amount: item.amount,
            quantity: item.quantity,
            unit: item.unit,
            sort_order: sortOrder,
        }, {
            onConflict: 'building_id,description'
        })
        .select('id')
        .single();

    if (error) {
        handleDbError(error, 'saveExpenseItem');
        console.warn('Failed to save expense item:', error.message);
        return null;
    }
    return data?.id || null;
};

export const deleteExpenseItem = async (id: number): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('expense_items')
        .delete()
        .eq('id', id);

    if (error) {
        handleDbError(error, 'deleteExpenseItem');
        console.warn('Failed to delete expense item:', error.message);
    }
};
