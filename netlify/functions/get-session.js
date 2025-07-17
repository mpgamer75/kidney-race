// netlify/functions/get-session.js

// Simulation d'une base de données en mémoire
const sessions = new Map();
const players = new Map();

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
        console.log('🔍 Getting session:', sessionCode);
        
        if (!sessionCode) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Session code required' })
            };
        }

        // Simuler session trouvée
        const session = {
            id: sessionCode,
            instructor_code: sessionCode,
            status: 'waiting',
            current_question: 0
        };

        // Simuler joueurs (vide au début)
        const playersInSession = Array.from(players.values())
            .filter(p => p.session_id === sessionCode);

        // Simuler équipes
        const teamScores = [];
        for (let i = 0; i < 5; i++) {
            teamScores.push({
                session_id: sessionCode,
                team_index: i,
                total_score: 0
            });
        }

        console.log('✅ Session found:', { session, players: playersInSession.length });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                session: session,
                players: playersInSession,
                teamScores: teamScores
            })
        };
    } catch (error) {
        console.error('❌ Error getting session:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};