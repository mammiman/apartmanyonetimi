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
                console.warn('[API] Supabase bağlantısı başarısız. Hata:', {
                    settings: settingsCheck.error?.message,
                    apartments: apartmentsCheck.error?.message,
                    code: err?.code
                });
            } else {
                _dbAvailable = true;
                console.log('[API] DB bağlantısı başarılı (Building & Apartments OK).');
            }
        } catch (err: any) {
            _dbAvailable = false;
            console.warn('[API] Supabase erişilemez - Beklenmedik hata:', err?.message || err);
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

// ===== Çoklu Bina API =====

/** Kullanıcının ait olduğu tüm binaları getirir */
export const fetchUserBuildings = async (): Promise<{ id: string; name: string; access_code: string; role: string }[]> => {
    // Önce auth kontrolü - DB bekleme olmadan
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) return [];
        const userId = sessionData.session.user.id;

        // DB hazır değilse boş dön (DB'yi kapatma)
        if (_dbAvailable === false) return [];

        // user_buildings tablosundan sadece building_id'leri çek (join YOK)
        const { data: ubData, error: ubErr } = await supabase
            .from('user_buildings')
            .select('building_id, role')
            .eq('user_id', userId);

        if (ubErr) {
            // 406 veya diğer hatalar için DB'yi KAPATMA, sadece warn
            console.warn('fetchUserBuildings user_buildings error:', ubErr.message, ubErr.code);
            return [];
        }
        if (!ubData || ubData.length === 0) return [];

        // Mülk id'lerinden bina bilgilerini çek
        const buildingIds = ubData.map((r: any) => r.building_id).filter(Boolean);
        const { data: bData, error: bErr } = await supabase
            .from('buildings')
            .select('id, name, access_code')
            .in('id', buildingIds);

        if (bErr) {
            console.warn('fetchUserBuildings buildings error:', bErr.message);
            return [];
        }

        return (bData || []).map((b: any) => {
            const ub = ubData.find((u: any) => u.building_id === b.id);
            return { id: b.id, name: b.name || '?', access_code: b.access_code || '', role: ub?.role || 'admin' };
        });
    } catch (e) {
        console.warn('fetchUserBuildings unexpected error:', e);
        return [];
    }
};

/** Bina koduna göre kullanıcıyı bir binaya ekler */
export const addUserToBuilding = async (accessCode: string): Promise<{ id: string; name: string } | null> => {
    if (!(await waitForDb())) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return null;

    // Bina kodu ile binayi bul
    const { data: building, error: bErr } = await supabase
        .from('buildings')
        .select('id, name')
        .eq('access_code', accessCode.trim().toUpperCase())
        .maybeSingle();

    if (bErr || !building) return null;

    // user_buildings tablosuna ekle (zaten varsa 23505 hatası yoksay)
    const { error: ubErr } = await supabase
        .from('user_buildings')
        .insert({ user_id: userId, building_id: building.id, role: 'admin' });

    if (ubErr && ubErr.code !== '23505') {
        console.warn('addUserToBuilding error:', ubErr.message);
        return null;
    }

    return building;
};



// Type definitions for database entities
export interface DbApartment {
    id: number;
    apartment_number: number;
    resident_name: string;
    owner_name: string;
    has_elevator: boolean;
    block: string;
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
        blok: apt.block,
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
        block: apartment.blok || ''
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

export const updateApartment = async (apartmentNumber: number, updates: Partial<Apartment>, block?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const dbUpdates: any = {};
    if (updates.sakinAdi !== undefined) dbUpdates.resident_name = updates.sakinAdi;
    if (updates.mulkSahibi !== undefined) dbUpdates.owner_name = updates.mulkSahibi;
    if (updates.asansorTabi !== undefined) dbUpdates.has_elevator = updates.asansorTabi;
    if (updates.accessCode !== undefined) dbUpdates.access_code = updates.accessCode;
    if (updates.blok !== undefined) dbUpdates.block = updates.blok;

    let query = supabase.from('apartments').update(dbUpdates).eq('apartment_number', apartmentNumber);
    if (block !== undefined) query = query.eq('block', block);
    const { error } = await query;

    if (error) {
        handleDbError(error, 'updateApartment');
        throw error;
    }
};

export const deleteApartment = async (apartmentNumber: number, block?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    let query = supabase.from('apartments').delete().eq('apartment_number', apartmentNumber);
    if (block !== undefined) query = query.eq('block', block);
    const { error } = await query;

    if (error) {
        handleDbError(error, 'deleteApartment');
        throw error;
    }
};

// Dues API
export const fetchDues = async (year: number, buildingId?: string): Promise<MonthlyDues[]> => {
    if (!(await waitForDb())) return [];
    // Fetch apartments first
    let query = supabase
        .from('apartments')
        .select('id, apartment_number, resident_name, block');

    if (buildingId) query = query.eq('building_id', buildingId);

    const { data: apartments, error: aptError } = await query;

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
            blok: apt.block,
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

/**
 * Dairenin devreden borcunu günceller/oluşturur.
 */
export const updateCarriedDebt = async (
    apartmentNo: number,
    amount: number,
    year: number,
    buildingId?: string,
    block?: string
): Promise<void> => {
    if (!(await waitForDb())) return;

    // 1. Daireyi bul
    let aptQuery = supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNo);

    if (block) aptQuery = aptQuery.eq('block', block);
    if (buildingId) aptQuery = aptQuery.eq('building_id', buildingId);

    const { data: apt, error: aptError } = await aptQuery.maybeSingle();

    if (aptError || !apt) {
        console.error('updateCarriedDebt: Apartment not found', apartmentNo, block);
        return;
    }

    // 2. monthly_dues kaydını upsert et
    const { error } = await supabase
        .from('monthly_dues')
        .upsert({
            apartment_id: apt.id,
            year,
            carried_debt: amount
        }, { onConflict: 'apartment_id, year' });

    if (error) {
        handleDbError(error, 'updateCarriedDebt');
        throw error;
    }
};

/**
 * Aidat ödemesini kaydeder.
 */
export const updateDuesPayment = async (
    apartmentNumber: number,
    month: string,
    amount: number,
    year: number,
    block?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    let query = supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber);

    if (block !== undefined) query = query.eq('block', block);

    const { data: apt, error: aptError } = await query.single();

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
            .upsert({ apartment_id: apt.id, year }, { onConflict: 'apartment_id,year' })
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
    year: number,
    block?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    let query = supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber);

    if (block !== undefined) query = query.eq('block', block);

    const { data: apt, error: aptError } = await query.single();

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
    year: number,
    block?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    let query = supabase
        .from('apartments')
        .select('id')
        .eq('apartment_number', apartmentNumber);

    if (block !== undefined) query = query.eq('block', block);

    const { data: apt, error: aptError } = await query.single();

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

    data.forEach((entry: any) => {
        const row: any = {
            id: entry.id,
            aciklama: entry.description,
            kisi: entry.person || '',
            tutar: entry.amount,
            tarih: entry.tarih || '',
            kategori: entry.kategori || '',
            displayAciklama: entry.display_aciklama || entry.description,
            daireNo: entry.daire_no || undefined,
            sakinAdi: entry.sakin_adi || undefined,
            ay: entry.ay || month,
            tip: entry.type === 'income' ? 'gelir' : 'gider',
        };

        if (entry.type === 'income') {
            gelirler.push(row);
        } else {
            giderler.push(row);
        }
    });

    return { gelirler, giderler };
};

/**
 * Tüm ayların ledger kayıtlarını TEK sorguda çeker.
 * 12 ayrı HTTP isteği yerine 1 istek → çok daha hızlı yükleme.
 */
export const fetchAllLedgerEntries = async (buildingId?: string): Promise<Record<string, { gelirler: LedgerRow[]; giderler: LedgerRow[] }>> => {
    if (!(await waitForDb())) return {};

    let query = supabase
        .from('ledger_entries')
        .select('*')
        .order('created_at');

    if (buildingId) query = query.eq('building_id', buildingId);

    console.log(`[API] Fetching all ledger entries for building: ${buildingId}`);
    const { data, error } = await query;

    if (error) {
        console.error(`[API] fetchAllLedgerEntries error:`, error);
        handleDbError(error, 'fetchAllLedgerEntries');
        throw error;
    }

    console.log(`[API] Fetched ${data?.length || 0} ledger entries`);

    const result: Record<string, { gelirler: LedgerRow[]; giderler: LedgerRow[] }> = {};

    (data || []).forEach((entry: any) => {
        const month = entry.month;
        if (!result[month]) {
            result[month] = { gelirler: [], giderler: [] };
        }

        const row: any = {
            id: entry.id,
            aciklama: entry.description,
            kisi: entry.person || '',
            tutar: entry.amount,
            tarih: entry.tarih || '',
            kategori: entry.kategori || '',
            displayAciklama: entry.display_aciklama || entry.description,
            daireNo: entry.daire_no || undefined,
            sakinAdi: entry.sakin_adi || undefined,
            ay: entry.ay || month,
            tip: entry.type === 'income' ? 'gelir' : 'gider',
            photoId: entry.photo_id || undefined,
        };

        if (entry.type === 'income') {
            result[month].gelirler.push(row);
        } else {
            result[month].giderler.push(row);
        }
    });

    return result;
};

export const createLedgerEntry = async (
    month: string,
    type: 'gelir' | 'gider',
    entry: Omit<LedgerRow, 'id'>,
    buildingId?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    const e = entry as any;
    const insertData: any = {
        month,
        type: type === 'gelir' ? 'income' : 'expense',
        description: entry.aciklama,
        person: e.kisi || null,
        amount: entry.tutar,
        // Extended fields
        kategori: e.kategori || null,
        display_aciklama: e.displayAciklama || null,
        tarih: e.tarih || null,
        daire_no: e.daireNo || null,
        sakin_adi: e.sakinAdi || null,
        ay: e.ay || month,
    };
    if (buildingId) insertData.building_id = buildingId;
    if (e.photoId) insertData.photo_id = e.photoId; // Only send if present

    console.log(`[API] Creating ledger entry for ${month} (${type}):`, entry.aciklama);

    const { error } = await supabase
        .from('ledger_entries')
        .insert(insertData);

    if (error) {
        console.error(`[API] createLedgerEntry error:`, error);
        handleDbError(error, 'createLedgerEntry');
        throw error;
    }
    console.log(`[API] Ledger entry created successfully`);
};

/**
 * Aidat ödemelerini ledger_entries tablosuna upsert eder.
 * description = 'aidat_dues_{daireNo}' olarak kullanılır (unique key).
 */
export const upsertLedgerAidatEntry = async (
    month: string,
    daireNo: number,
    sakinAdi: string,
    amount: number,
    buildingId?: string,
    blok?: string
): Promise<void> => {
    if (!(await waitForDb())) return;
    const blockSuffix = blok ? `_${blok}` : '';
    const tag = `aidat_dues_${daireNo}${blockSuffix}`;
    const displayAciklama = `${sakinAdi} ${blok ? `(${blok}) ` : ''}(D:${daireNo}) - ${month} Aidatı`;

    if (amount <= 0) {
        // Ödeme silinmişse DB'den de sil
        const { error } = await supabase
            .from('ledger_entries')
            .delete()
            .eq('description', tag)
            .eq('month', month)
            .eq('building_id', buildingId || null);
        if (error) console.warn('upsertLedgerAidatEntry delete error:', error.message);
        return;
    }

    // Önce var mı kontrol et
    let filterQuery = supabase
        .from('ledger_entries')
        .select('id')
        .eq('description', tag)
        .eq('month', month);
    if (buildingId) filterQuery = filterQuery.eq('building_id', buildingId);
    const { data: existing } = await filterQuery.maybeSingle();

    const payload: any = {
        month,
        type: 'income',
        description: tag,
        amount,
        kategori: 'Aidat Ödemesi',
        display_aciklama: displayAciklama,
        tarih: '',
        daire_no: daireNo,
        sakin_adi: sakinAdi,
        ay: month,
    };
    if (buildingId) payload.building_id = buildingId;

    if (existing?.id) {
        const { error } = await supabase
            .from('ledger_entries')
            .update({ amount, display_aciklama: displayAciklama, sakin_adi: sakinAdi })
            .eq('id', existing.id);
        if (error) console.warn('upsertLedgerAidatEntry update error:', error.message);
    } else {
        const { error } = await supabase
            .from('ledger_entries')
            .insert(payload);
        if (error) console.warn('upsertLedgerAidatEntry insert error:', error.message);
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
        mesai: record.mesai || 0,
        odenen: record.odenen || 0,
        avans: record.avans || 0,
        alacak: record.alacak || 0,
        toplamOdenen: record.toplam_odenen || 0,
    }));
};

export const updateStaffRecord = async (month: string, updates: Partial<StaffRecord>, buildingId?: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const dbUpdates: any = {};
    if (updates.maas !== undefined) dbUpdates.manager_salary = updates.maas;
    if (updates.mesai !== undefined) dbUpdates.mesai = updates.mesai;
    if (updates.odenen !== undefined) dbUpdates.odenen = updates.odenen;
    if (updates.avans !== undefined) dbUpdates.avans = updates.avans;
    if (updates.alacak !== undefined) dbUpdates.alacak = updates.alacak;
    if (updates.toplamOdenen !== undefined) dbUpdates.toplam_odenen = updates.toplamOdenen;

    const upsertData: any = { month, ...dbUpdates };
    if (buildingId) upsertData.building_id = buildingId;

    console.log(`[API] Updating staff record for ${month} in building ${buildingId}`);

    const { error } = await supabase
        .from('staff_records')
        .upsert(upsertData, {
            onConflict: 'building_id,month'
        });

    if (error) {
        console.error(`[API] updateStaffRecord error:`, error);
        handleDbError(error, 'updateStaffRecord');
        throw error;
    }
    console.log(`[API] Staff record updated successfully`);
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
        description: row.description || '',
        amount: row.amount || 0,
        quantity: row.quantity || 1,
        unit: row.unit || '',
    })) || null;
};

export const saveExpenseItem = async (buildingId: string, item: any, sortOrder: number): Promise<number | null> => {
    if (!(await waitForDb())) return null;
    
    const upsertData: any = {
        building_id: buildingId,
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
        unit: item.unit,
        sort_order: sortOrder,
    };
    
    // Eğer ID varsa onu kullan (güncelleme için)
    if (item.id && typeof item.id === 'number') {
        upsertData.id = item.id;
    }

    const { data, error } = await supabase
        .from('expense_items')
        .upsert(upsertData, {
            onConflict: item.id && typeof item.id === 'number' ? 'id' : 'building_id,description'
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

// Announcements
export const fetchAnnouncements = async (buildingId: string): Promise<any[]> => {
    if (!(await waitForDb())) return [];
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false });

    if (error) {
        handleDbError(error, 'fetchAnnouncements');
        return [];
    }
    return (data || []).map(a => ({
        id: a.id,
        message: a.message,
        photoId: a.photo_id,
        date: new Date(a.created_at).toLocaleDateString('tr-TR')
    }));
};

export const createAnnouncement = async (buildingId: string, message: string, photoId?: string): Promise<any> => {
    if (!(await waitForDb())) return null;
    const insertData: any = {
        building_id: buildingId,
        message: message,
    };
    if (photoId) insertData.photo_id = photoId; // Only send if present

    const { data, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        handleDbError(error, 'createAnnouncement');
        throw error;
    }
    return data;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    if (!(await waitForDb())) return;
    const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

    if (error) {
        handleDbError(error, 'deleteAnnouncement');
        throw error;
    }
};
