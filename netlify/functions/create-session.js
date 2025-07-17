// netlify/functions/create-session.js

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Gérer OPTIONS pour CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Accepter GET ET POST pour cette function
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🎯 Creating session...');
        
        // Simuler création de session (sans Supabase pour test)
        const sessionCode = generateSessionCode();
        const session = {
            id: sessionCode,
            instructor_code: sessionCode,
            status: 'waiting',
            created_at: new Date().toISOString()
        };

        console.log('✅ Session created:', session);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                session: session
            })
        };
    } catch (error) {
        console.error('❌ Error creating session:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
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