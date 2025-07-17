const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const challenges = [
    {
        type: "⚡ DESAFÍO RELÁMPAGO",
        difficulty: 2,
        time: 20,
        question: "¿Qué estructura del nefrón es responsable de la filtración selectiva de proteínas plasmáticas?",
        options: ["Cápsula de Bowman", "Barrera de filtración glomerular", "Túbulo contorneado proximal", "Asa de Henle"],
        correct: 1,
        points: 15
    },
    {
        type: "🧩 IDENTIFICACIÓN",
        difficulty: 2,
        time: 20,
        question: "¿Cuál es la hormona que regula la reabsorción de sodio en el túbulo distal?",
        options: ["ADH", "Aldosterona", "Eritropoyetina", "Renina"],
        correct: 1,
        points: 15
    },
    {
        type: "🚀 BONUS RACE",
        difficulty: 4,
        time: 25,
        question: "En la acidosis metabólica, ¿qué células del túbulo distal secretan H+ y reabsorben HCO3-?",
        options: ["Células principales", "Células intercaladas tipo A", "Células intercaladas tipo B", "Podocitos"],
        correct: 1,
        points: 30
    },
    {
        type: "⚡ DESAFÍO RELÁMPAGO",
        difficulty: 3,
        time: 20,
        question: "¿Qué valor de clearance de creatinina indica insuficiencia renal crónica estadio 3?",
        options: ["90-120 mL/min", "60-89 mL/min", "30-59 mL/min", "15-29 mL/min"],
        correct: 2,
        points: 20
    },
    {
        type: "🧩 IDENTIFICACIÓN",
        difficulty: 3,
        time: 25,
        question: "¿Qué transportador en el túbulo proximal es inhibido por los diuréticos de asa?",
        options: ["NCC", "NKCC2", "ENaC", "AQP2"],
        correct: 1,
        points: 20
    },
    {
        type: "🚀 BONUS RACE",
        difficulty: 5,
        time: 30,
        question: "¿Cuál es el mecanismo de retroalimentación tubuloglomerular que regula la TFG?",
        options: ["Mácula densa → renina", "Mácula densa → adenosina → vasoconstricción", "Podocitos → óxido nítrico", "Mesangio → endotelina"],
        correct: 1,
        points: 40
    },
    {
        type: "⚡ DESAFÍO RELÁMPAGO",
        difficulty: 2,
        time: 20,
        question: "¿Qué célula del aparato yuxtaglomerular secreta renina?",
        options: ["Células de la mácula densa", "Células yuxtaglomerulares", "Células mesangiales", "Podocitos"],
        correct: 1,
        points: 15
    },
    {
        type: "🧩 IDENTIFICACIÓN",
        difficulty: 3,
        time: 25,
        question: "¿Qué estructura permite la concentración de orina mediante el mecanismo de contracorriente?",
        options: ["Glomérulo", "Túbulo proximal", "Asa de Henle", "Túbulo distal"],
        correct: 2,
        points: 20
    },
    {
        type: "🚀 BONUS RACE",
        difficulty: 5,
        time: 35,
        question: "En la enfermedad renal crónica, ¿a partir de qué estadio se debe considerar diálisis?",
        options: ["Estadio 3 (TFG 30-59)", "Estadio 4 (TFG 15-29)", "Estadio 5 (TFG <15)", "Cualquier estadio con síntomas"],
        correct: 2,
        points: 45
    },
    {
        type: "⚡ DESAFÍO RELÁMPAGO",
        difficulty: 2,
        time: 20,
        question: "¿Qué hormona estimula la síntesis de eritropoyetina?",
        options: ["Hipoxia", "Hipercapnia", "Hiponatremia", "Hipercalemia"],
        correct: 0,
        points: 15
    }
];

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
        const { action, sessionId, playerId, questionIndex, selectedOption, isCorrect, points } = JSON.parse(event.body);

        switch (action) {
            case 'start_game':
                return await handleStartGame(sessionId, headers);
            case 'submit_answer':
                return await handleSubmitAnswer(sessionId, playerId, questionIndex, selectedOption, isCorrect, points, headers);
            case 'next_question':
                return await handleNextQuestion(sessionId, headers);
            case 'reset_game':
                return await handleResetGame(sessionId, headers);
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Unknown action' })
                };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function handleStartGame(sessionId, headers) {
    await supabase
        .from('game_sessions')
        .update({
            status: 'playing',
            current_question: 0
        })
        .eq('id', sessionId);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            question: challenges[0],
            questionIndex: 0
        })
    };
}

async function handleSubmitAnswer(sessionId, playerId, questionIndex, selectedOption, isCorrect, points, headers) {
    // Guardar respuesta
    await supabase
        .from('player_answers')
        .insert([{
            session_id: sessionId,
            player_id: playerId,
            question_index: questionIndex,
            selected_option: selectedOption,
            is_correct: isCorrect,
            response_time: 0,
            points_earned: points
        }]);

    // Actualizar puntuación si es correcta
    if (points > 0) {
        const { data: player } = await supabase
            .from('players')
            .select('team_index')
            .eq('id', playerId)
            .single();

        // Actualizar score del jugador
        await supabase
            .from('players')
            .update({ score: supabase.sql`score + ${points}` })
            .eq('id', playerId);

        // Actualizar score del equipo
        await supabase
            .from('team_scores')
            .update({ total_score: supabase.sql`total_score + ${points}` })
            .eq('session_id', sessionId)
            .eq('team_index', player.team_index);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            isCorrect: isCorrect,
            points: points
        })
    };
}

async function handleNextQuestion(sessionId, headers) {
    const { data: session } = await supabase
        .from('game_sessions')
        .select('current_question')
        .eq('id', sessionId)
        .single();

    const nextQuestion = session.current_question + 1;
    
    if (nextQuestion >= challenges.length) {
        // Fin del juego
        await supabase
            .from('game_sessions')
            .update({ status: 'finished' })
            .eq('id', sessionId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                gameEnded: true
            })
        };
    }

    // Actualizar en base de datos
    await supabase
        .from('game_sessions')
        .update({ current_question: nextQuestion })
        .eq('id', sessionId);

    const challenge = challenges[nextQuestion];
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            question: challenge,
            questionIndex: nextQuestion
        })
    };
}

async function handleResetGame(sessionId, headers) {
    // Reset en base de datos
    await supabase.from('players').update({ score: 0 }).eq('session_id', sessionId);
    await supabase.from('team_scores').update({ total_score: 0 }).eq('session_id', sessionId);
    await supabase.from('game_sessions').update({ 
        status: 'waiting', 
        current_question: 0 
    }).eq('id', sessionId);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Game reset successfully'
        })
    };
}