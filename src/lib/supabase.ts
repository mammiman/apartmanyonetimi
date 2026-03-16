import { createClient } from '@supabase/supabase-js';
import { getActiveBuildingId, setActiveBuildingId } from './buildingSelection';

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

    const { data: apt, error } = await supabase
        .rpc('verify_access_code', { p_access_code: codeUpper });

    if (error || !apt) {
        throw new Error('Geçersiz erişim kodu');
    }

    const residentSession = {
        apartmentId: apt.apartment_number,
        residentName: apt.resident_name,
        blok: apt.block || null,
        accessCode: codeUpper,
        role: 'resident',
        buildingId: apt.building_id || null,
        loginTime: new Date().toISOString()
    };

    if (apt.building_id) {
        setActiveBuildingId(apt.building_id);
    }

    localStorage.setItem('residentSession', JSON.stringify(residentSession));
    return {
        user: {
            id: `resident_${apt.building_id}_${apt.apartment_number}_${apt.block || 'default'}`,
            email: `daire${apt.apartment_number}.${apt.block || 'default'}.${apt.building_id}@resident.local`,
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

export const sendPasswordResetEmail = async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}#/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
};

export const updateCurrentUserPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
};

export const signOut = async () => {
    // Clear resident session from localStorage
    localStorage.removeItem('residentSession');
    setActiveBuildingId(null);

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
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        // If no user or session, return null instead of throwing
        if (error || !user) {
            console.log('getCurrentUser - No active session found or error:', error?.message);
            return null;
        }

        // Use RPC to bypass RLS on users table
        const { data: profile, error: profileError } = await supabase.rpc('get_my_profile');

        if (profileError || !profile) {
            throw profileError || new Error('User profile not found');
        }

        return { ...user, profile };
    } catch (authErr) {
        console.error('getCurrentUser - Auth getUser failed:', authErr);
        return null;
    }
};

export const generateAccessCode = async (apartmentId: number): Promise<string> => {
    throw new Error(`generateAccessCode is disabled in DB-only mode (apartmentId=${apartmentId})`);
};
// Erişim kodu oluştur ve Supabase'de hem apartments hem users tablosuna kaydet
export const generateAndSaveAccessCode = async (apartmentNumber: number, residentName: string, blok?: string): Promise<string> => {
    const buildingId = getActiveBuildingId() || await getBuildingId();

    // Tek RPC çağrısı ile her şeyi yap: kod üret + apartments güncelle + users'a ekle
    const { data, error } = await supabase.rpc('generate_access_code_and_user', {
        p_apartment_number: apartmentNumber,
        p_resident_name: residentName,
        p_building_id: buildingId,
        p_blok: blok
    });

    if (error || !data) {
        throw error || new Error('Erişim kodu üretilemedi');
    }

    const code = data as string;
    console.log(`✅ Access code generated & resident user created for apartment ${apartmentNumber} (${blok || 'no block'}): ${code}`);
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
