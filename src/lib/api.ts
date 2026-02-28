import { supabase } from './supabase';
import { Apartment, MonthlyDues, LedgerRow, StaffRecord } from '@/data/initialData';

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
    let query = supabase
        .from('apartments')
        .select('*')
        .order('apartment_number');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) throw error;

    return data.map(apt => ({
        daireNo: apt.apartment_number,
        sakinAdi: apt.resident_name,
        mulkSahibi: apt.owner_name,
        asansorTabi: apt.has_elevator,
        accessCode: apt.access_code || undefined,
    }));
};

export const createApartment = async (apartment: Omit<Apartment, 'daireNo'> & { daireNo: number }, buildingId?: string): Promise<void> => {
    const insertData: any = {
        apartment_number: apartment.daireNo,
        resident_name: apartment.sakinAdi,
        owner_name: apartment.mulkSahibi,
        has_elevator: apartment.asansorTabi,
    };
    if (apartment.accessCode) insertData.access_code = apartment.accessCode;
    if (buildingId) insertData.building_id = buildingId;

    const { error } = await supabase
        .from('apartments')
        .insert(insertData);

    if (error) throw error;
};

export const updateApartment = async (apartmentNumber: number, updates: Partial<Apartment>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.sakinAdi !== undefined) dbUpdates.resident_name = updates.sakinAdi;
    if (updates.mulkSahibi !== undefined) dbUpdates.owner_name = updates.mulkSahibi;
    if (updates.asansorTabi !== undefined) dbUpdates.has_elevator = updates.asansorTabi;
    if (updates.accessCode !== undefined) dbUpdates.access_code = updates.accessCode;

    const { error } = await supabase
        .from('apartments')
        .update(dbUpdates)
        .eq('apartment_number', apartmentNumber);

    if (error) throw error;
};

export const deleteApartment = async (apartmentNumber: number): Promise<void> => {
    const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('apartment_number', apartmentNumber);

    if (error) throw error;
};

// Dues API
export const fetchDues = async (year: number): Promise<MonthlyDues[]> => {
    // Fetch apartments first
    const { data: apartments, error: aptError } = await supabase
        .from('apartments')
        .select('id, apartment_number, resident_name');

    if (aptError) throw aptError;

    // Fetch dues for the year
    const { data: dues, error: duesError } = await supabase
        .from('monthly_dues')
        .select(`
      *,
      monthly_payments (*),
      extra_fees (*)
    `)
        .eq('year', year);

    if (duesError) throw duesError;

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
    // Get apartment ID
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) throw aptError;

    // Get or create monthly_dues record
    let { data: duesRecord, error: duesError } = await supabase
        .from('monthly_dues')
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('year', year)
        .single();

    if (duesError && duesError.code !== 'PGRST116') throw duesError;

    if (!duesRecord) {
        const { data: newDues, error: createError } = await supabase
            .from('monthly_dues')
            .insert({ apartment_id: apt.id, year })
            .select('id')
            .single();

        if (createError) throw createError;
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

    if (paymentError) throw paymentError;

    // Recalculate totals
    await recalculateDuesTotals(duesRecord.id);
};

export const updateElevatorPayment = async (
    apartmentNumber: number,
    amount: number,
    year: number
): Promise<void> => {
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) throw aptError;

    const { error } = await supabase
        .from('monthly_dues')
        .upsert({
            apartment_id: apt.id,
            year,
            elevator_payment: amount,
        }, {
            onConflict: 'apartment_id,year'
        });

    if (error) throw error;

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
    const { data: apt, error: aptError } = await supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber)
        .single();

    if (aptError) throw aptError;

    // Get or create monthly_dues record
    let { data: duesRecord, error: duesError } = await supabase
        .from('monthly_dues')
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('year', year)
        .single();

    if (duesError && duesError.code !== 'PGRST116') throw duesError;

    if (!duesRecord) {
        const { data: newDues, error: createError } = await supabase
            .from('monthly_dues')
            .insert({ apartment_id: apt.id, year })
            .select('id')
            .single();

        if (createError) throw createError;
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

    if (feeError) throw feeError;

    await recalculateDuesTotals(duesRecord.id);
};

// Helper function to recalculate dues totals
const recalculateDuesTotals = async (duesId: number): Promise<void> => {
    const { data, error } = await supabase
        .from('monthly_dues')
        .select(`
      *,
      monthly_payments (amount),
      extra_fees (amount)
    `)
        .eq('id', duesId)
        .single();

    if (error) throw error;

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

    if (updateError) throw updateError;
};

// Dues Columns API
export const fetchDuesColumns = async (buildingId?: string): Promise<string[]> => {
    let query = supabase
        .from('dues_columns')
        .select('column_name')
        .order('created_at');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) throw error;
    return data.map(d => d.column_name);
};

export const createDuesColumn = async (columnName: string, buildingId?: string): Promise<void> => {
    const insertData: any = { column_name: columnName };
    if (buildingId) insertData.building_id = buildingId;

    const { error } = await supabase
        .from('dues_columns')
        .insert(insertData);

    if (error) throw error;
};

export const deleteDuesColumn = async (columnName: string): Promise<void> => {
    const { error } = await supabase
        .from('dues_columns')
        .delete()
        .eq('column_name', columnName);

    if (error) throw error;
};

// Ledger API
export const fetchLedgerEntries = async (month: string, buildingId?: string) => {
    let query = supabase
        .from('ledger_entries')
        .select('*')
        .eq('month', month)
        .order('created_at');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) throw error;

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

    if (error) throw error;
};

export const deleteLedgerEntry = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('ledger_entries')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// Staff Records API
export const fetchStaffRecords = async (buildingId?: string): Promise<StaffRecord[]> => {
    let query = supabase
        .from('staff_records')
        .select('*')
        .order('month');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) throw error;

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

    if (error) throw error;
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
    let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
};
