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
        const { sessionId, username, teamIndex } = JSON.parse(event.body);
        
        // Verificar límite de equipo
        const { data: teamPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('session_id', sessionId)
            .eq('team_index', teamIndex)
            .eq('is_connected', true);

        if (teamPlayers && teamPlayers.length >= 4) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'El equipo está completo' })
            };
        }

        // Verificar nombre único
        const { data: existingPlayer } = await supabase
            .from('players')
            .select('*')
            .eq('session_id', sessionId)
            .eq('username', username)
            .eq('is_connected', true);

        if (existingPlayer && existingPlayer.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Ese nombre ya está en uso' })
            };
        }

        // Crear jugador
        const { data: player, error } = await supabase
            .from('players')
            .insert([{
                session_id: sessionId,
                username: username,
                team_index: teamIndex,
                score: 0,
                is_connected: true
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                player: player
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
