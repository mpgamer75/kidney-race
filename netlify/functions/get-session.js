const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { sessionCode } = event.queryStringParameters || {};
        
        if (!sessionCode) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Session code required' })
            };
        }

        const { data: session } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('instructor_code', sessionCode)
            .single();

        if (!session) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Session not found' })
            };
        }

        // Obtener jugadores
        const { data: players } = await supabase
            .from('players')
            .select('*')
            .eq('session_id', session.id)
            .eq('is_connected', true)
            .order('joined_at');

        // Obtener puntuaciones de equipos
        const { data: teamScores } = await supabase
            .from('team_scores')
            .select('*')
            .eq('session_id', session.id)
            .order('team_index');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                session: session,
                players: players || [],
                teamScores: teamScores || []
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
