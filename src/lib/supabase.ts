import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper functions
export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
};

export const signInWithAccessCode = async (accessCode: string) => {
    const codeUpper = accessCode.toUpperCase();

    // 1) Supabase RPC ile erişim kodunu doğrula (RLS'yi bypass eder)
    try {
        const { data: apt, error } = await supabase
            .rpc('verify_access_code', { p_access_code: codeUpper });

        if (!error && apt) {
            // building_id'yi localStorage'a kaydet (sakin de doğru binaya bağlansın)
            if (apt.building_id) {
                localStorage.setItem('selectedBuildingId', apt.building_id);
            }

            const residentSession = {
                apartmentId: apt.apartment_number,
                residentName: apt.resident_name,
                accessCode: codeUpper,
                role: 'resident',
                buildingId: apt.building_id || null,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('residentSession', JSON.stringify(residentSession));
            return {
                user: {
                    id: `resident_${apt.apartment_number}`,
                    email: `daire${apt.apartment_number}@resident.local`,
                    role: 'resident'
                },
                session: residentSession
            };
        }
    } catch (dbErr) {
        console.warn('DB access code RPC failed, falling back to localStorage', dbErr);
    }

    // 2) Fallback: localStorage'da kontrol et (geriye dönük uyumluluk)
    const accessCodes = JSON.parse(localStorage.getItem('accessCodes') || '{}');
    const apartmentId = Object.keys(accessCodes).find(key =>
        accessCodes[key].code === accessCode ||
        (accessCodes[key].code && accessCodes[key].code.toUpperCase() === codeUpper)
    );

    if (!apartmentId) {
        if (accessCodes[accessCode]) {
            const residentSession = {
                apartmentId: accessCodes[accessCode].apartmentId,
                residentName: accessCodes[accessCode].residentName || '',
                accessCode,
                role: 'resident',
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('residentSession', JSON.stringify(residentSession));
            return {
                user: { id: `resident_${accessCode}`, email: `${accessCode}@resident.local`, role: 'resident' },
                session: residentSession
            };
        }
        throw new Error('Geçersiz erişim kodu');
    }

    const residentSession = {
        apartmentId: parseInt(apartmentId),
        residentName: accessCodes[apartmentId]?.residentName || '',
        accessCode,
        role: 'resident',
        loginTime: new Date().toISOString()
    };
    localStorage.setItem('residentSession', JSON.stringify(residentSession));
    return {
        user: {
            id: `resident_${accessCode}`,
            email: `${accessCode}@resident.local`,
            role: 'resident'
        },
        session: residentSession
    };
};

export const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) throw error;
    return data;
};

export const signOut = async () => {
    // Clear resident session from localStorage
    localStorage.removeItem('residentSession');

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

// Building management
export const joinBuildingByCode = async (code: string) => {
    const { data, error } = await supabase.rpc('join_building_by_code', {
        p_code: code.toUpperCase(),
    });

    if (error) throw error;
    return data; // returns building_id (UUID)
};

export const getBuildingId = async (): Promise<string | null> => {
    const { data: profile, error } = await supabase.rpc('get_my_profile');

    if (error || !profile) return null;
    return profile.building_id;
};

export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();

    // If no user or session, return null instead of throwing
    if (error || !user) {
        console.log('getCurrentUser - No active session found');
        return null;
    }

    // Use RPC to bypass RLS on users table
    const { data: profile, error: profileError } = await supabase.rpc('get_my_profile');

    if (profileError || !profile) {
        console.warn('User profile not found in database, assuming admin role');
        return {
            ...user,
            profile: {
                id: user.id,
                role: 'admin',
                apartment_id: null,
                access_code: null,
                building_id: null
            }
        };
    }

    return { ...user, profile };
};

export const generateAccessCode = async (apartmentId: number): Promise<string> => {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // For now, just store the code in localStorage as a temporary solution
    // until we have proper admin API access
    const accessCodes = JSON.parse(localStorage.getItem('accessCodes') || '{}');
    accessCodes[code] = {
        apartmentId,
        createdAt: new Date().toISOString()
    };
    localStorage.setItem('accessCodes', JSON.stringify(accessCodes));

    return code;
};

// Erişim kodu oluştur ve Supabase'de hem apartments hem users tablosuna kaydet
export const generateAndSaveAccessCode = async (apartmentNumber: number, residentName: string, _knownApartmentDbId?: number): Promise<string> => {
    const buildingId = localStorage.getItem('selectedBuildingId') || null;

    // Tek RPC çağrısı ile her şeyi yap: kod üret + apartments güncelle + users'a ekle
    try {
        const { data, error } = await supabase.rpc('generate_access_code_and_user', {
            p_apartment_number: apartmentNumber,
            p_resident_name: residentName,
            p_building_id: buildingId
        });

        if (error) {
            console.error('generate_access_code_and_user RPC error:', error);
        } else if (data) {
            const code = data as string;
            console.log(`✅ Access code generated & resident user created for apartment ${apartmentNumber}: ${code}`);

            // localStorage'a da yaz (geriye dönük uyumluluk)
            const accessCodes = JSON.parse(localStorage.getItem('accessCodes') || '{}');
            accessCodes[apartmentNumber] = {
                code: code,
                createdAt: new Date().toISOString(),
                residentName
            };
            localStorage.setItem('accessCodes', JSON.stringify(accessCodes));

            return code;
        }
    } catch (err) {
        console.error('generate_access_code_and_user failed:', err);
    }

    // Fallback: RPC başarısız olursa client-side kod üret (sadece localStorage)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.warn(`⚠️ Fallback: Access code generated client-side for apartment ${apartmentNumber}: ${code}`);

    const accessCodes = JSON.parse(localStorage.getItem('accessCodes') || '{}');
    accessCodes[apartmentNumber] = {
        code: code,
        createdAt: new Date().toISOString(),
        residentName
    };
    localStorage.setItem('accessCodes', JSON.stringify(accessCodes));

    return code;
};


export const revokeAccessCode = async (accessCode: string) => {
    // Find user with this access code
    const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('access_code', accessCode)
        .single();

    if (error) throw error;
    if (!user) throw new Error('Access code not found');

    // Delete the user (this will cascade to auth.users)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
};
