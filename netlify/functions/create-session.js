const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sessionCode = generateSessionCode();
        
        const { data: session, error } = await supabase
            .from('game_sessions')
            .insert([{
                instructor_code: sessionCode,
                status: 'waiting',
                created_at: new Date()
            }])
            .select()
            .single();

        if (error) throw error;

        // Crear equipos iniciales
        for (let i = 0; i < 5; i++) {
            await supabase
                .from('team_scores')
                .insert([{
                    session_id: session.id,
                    team_index: i,
                    total_score: 0
                }]);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                session: session
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}