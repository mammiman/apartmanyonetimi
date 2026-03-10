import { supabase } from './src/lib/supabase.js';

async function checkColumns() {
    try {
        const { data, error } = await supabase.from('apartments').select('*').limit(1);
        if (error) {
            console.error('Error fetching apartments:', error);
            return;
        }
        if (data && data.length > 0) {
            console.log('Columns in apartments table:', Object.keys(data[0]));
        } else {
            console.log('No data in apartments table to check columns.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkColumns();
