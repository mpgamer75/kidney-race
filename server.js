// =============================================
// KIDNEY RACING CHAMPIONSHIP - BACKEND SERVER
// =============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// =============================================
// CONFIGURACIÓN
// =============================================

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Supabase setup
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Puerto
const PORT = process.env.PORT || 3001;

// =============================================
// GAME STATE MANAGEMENT
// =============================================

class GameManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> GameSession
        this.playerSockets = new Map(); // socketId -> playerId
        this.challenges = [
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
    }

    async createSession(instructorCode) {
        try {
            const { data, error } = await supabase
                .from('game_sessions')
                .insert([{
                    instructor_code: instructorCode,
                    status: 'waiting'
                }])
                .select()
                .single();

            if (error) throw error;

            // Crear equipos iniciales
            for (let i = 0; i < 5; i++) {
                await supabase
                    .from('team_scores')
                    .insert([{
                        session_id: data.id,
                        team_index: i,
                        total_score: 0
                    }]);
            }

            this.sessions.set(data.id, {
                id: data.id,
                instructorCode: instructorCode,
                status: 'waiting',
                currentQuestion: 0,
                timer: 0,
                answers: new Map(),
                timerInterval: null
            });

            return data;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    async joinSession(sessionId, username, teamIndex, socketId) {
        try {
            // Verificar límite de equipo
            const { data: teamPlayers } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', sessionId)
                .eq('team_index', teamIndex);

            if (teamPlayers && teamPlayers.length >= 4) {
                throw new Error('Team is full');
            }

            // Verificar nombre único
            const { data: existingPlayer } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', sessionId)
                .eq('username', username);

            if (existingPlayer && existingPlayer.length > 0) {
                throw new Error('Username already exists');
            }

            // Crear jugador
            const { data, error } = await supabase
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

            // Mapear socket
            this.playerSockets.set(socketId, data.id);

            return data;
        } catch (error) {
            console.error('Error joining session:', error);
            throw error;
        }
    }

    async getSessionData(sessionId) {
        try {
            // Obtener sesión
            const { data: session } = await supabase
                .from('game_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            // Obtener jugadores
            const { data: players } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', sessionId)
                .order('joined_at');

            // Obtener puntuaciones de equipos
            const { data: teamScores } = await supabase
                .from('team_scores')
                .select('*')
                .eq('session_id', sessionId)
                .order('team_index');

            return {
                session,
                players: players || [],
                teamScores: teamScores || []
            };
        } catch (error) {
            console.error('Error getting session data:', error);
            throw error;
        }
    }

    async startGame(sessionId) {
        try {
            await supabase
                .from('game_sessions')
                .update({
                    status: 'playing',
                    current_question: 0
                })
                .eq('id', sessionId);

            const sessionState = this.sessions.get(sessionId);
            if (sessionState) {
                sessionState.status = 'playing';
                sessionState.currentQuestion = 0;
            }

            return true;
        } catch (error) {
            console.error('Error starting game:', error);
            throw error;
        }
    }

    async submitAnswer(sessionId, playerId, questionIndex, selectedOption, responseTime) {
        try {
            const challenge = this.challenges[questionIndex];
            const isCorrect = selectedOption === challenge.correct;
            let points = 0;

            if (isCorrect) {
                points = challenge.points;
                // Speed bonus
                if (responseTime < challenge.time * 0.3 * 1000) {
                    points += 5;
                }
            }

            // Guardar respuesta
            await supabase
                .from('player_answers')
                .insert([{
                    session_id: sessionId,
                    player_id: playerId,
                    question_index: questionIndex,
                    selected_option: selectedOption,
                    is_correct: isCorrect,
                    response_time: responseTime,
                    points_earned: points
                }]);

            // Actualizar puntuación del jugador
            const { data: player } = await supabase
                .from('players')
                .select('team_index')
                .eq('id', playerId)
                .single();

            if (points > 0) {
                // Actualizar score del jugador
                await supabase
                    .from('players')
                    .update({ score: supabase.sql`score + ${points}` })
                    .eq('id', playerId);

                // Actualizar score del equipo
                await supabase.rpc('update_team_score', {
                    p_session_id: sessionId,
                    p_team_index: player.team_index,
                    p_points: points
                });
            }

            return { isCorrect, points };
        } catch (error) {
            console.error('Error submitting answer:', error);
            throw error;
        }
    }

    startQuestionTimer(sessionId, duration) {
        const sessionState = this.sessions.get(sessionId);
        if (!sessionState) return;

        sessionState.timer = duration;
        
        clearInterval(sessionState.timerInterval);
        sessionState.timerInterval = setInterval(() => {
            sessionState.timer--;
            
            // Broadcast timer update
            io.to(sessionId).emit('timer_update', sessionState.timer);
            
            if (sessionState.timer <= 0) {
                clearInterval(sessionState.timerInterval);
                this.endQuestion(sessionId);
            }
        }, 1000);
    }

    async endQuestion(sessionId) {
        const sessionState = this.sessions.get(sessionId);
        if (!sessionState) return;

        // Mostrar resultados
        const challenge = this.challenges[sessionState.currentQuestion];
        io.to(sessionId).emit('question_ended', {
            correctAnswer: challenge.correct,
            explanation: challenge.explanation || null
        });

        // Enviar datos actualizados
        setTimeout(async () => {
            const sessionData = await this.getSessionData(sessionId);
            io.to(sessionId).emit('session_update', sessionData);
        }, 3000);
    }

    async nextQuestion(sessionId) {
        const sessionState = this.sessions.get(sessionId);
        if (!sessionState) return;

        sessionState.currentQuestion++;
        
        if (sessionState.currentQuestion >= this.challenges.length) {
            await this.endGame(sessionId);
            return;
        }

        // Actualizar en base de datos
        await supabase
            .from('game_sessions')
            .update({ current_question: sessionState.currentQuestion })
            .eq('id', sessionId);

        // Enviar nueva pregunta
        const challenge = this.challenges[sessionState.currentQuestion];
        io.to(sessionId).emit('new_question', {
            question: challenge,
            questionIndex: sessionState.currentQuestion
        });

        // Iniciar timer
        this.startQuestionTimer(sessionId, challenge.time);
    }

    async endGame(sessionId) {
        try {
            await supabase
                .from('game_sessions')
                .update({ status: 'finished' })
                .eq('id', sessionId);

            const sessionData = await this.getSessionData(sessionId);
            io.to(sessionId).emit('game_ended', sessionData);

            // Limpiar estado local
            const sessionState = this.sessions.get(sessionId);
            if (sessionState?.timerInterval) {
                clearInterval(sessionState.timerInterval);
            }
            this.sessions.delete(sessionId);
        } catch (error) {
            console.error('Error ending game:', error);
        }
    }
}

const gameManager = new GameManager();

// =============================================
// REST API ENDPOINTS
// =============================================

// Crear nueva sesión
app.post('/api/create-session', async (req, res) => {
    try {
        const instructorCode = generateInstructorCode();
        const session = await gameManager.createSession(instructorCode);
        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener sesión por código
app.get('/api/session/:code', async (req, res) => {
    try {
        const { data: session } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('instructor_code', req.params.code)
            .single();

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        const sessionData = await gameManager.getSessionData(session.id);
        res.json({ success: true, ...sessionData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// SOCKET.IO EVENTS
// =============================================

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Unirse a sesión
    socket.on('join_session', async (data) => {
        try {
            const { sessionId, username, teamIndex } = data;
            
            const player = await gameManager.joinSession(sessionId, username, teamIndex, socket.id);
            
            // Unirse al room
            socket.join(sessionId);
            
            // Confirmar unión
            socket.emit('joined_session', { player });
            
            // Actualizar a todos los jugadores
            const sessionData = await gameManager.getSessionData(sessionId);
            io.to(sessionId).emit('session_update', sessionData);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Iniciar juego (solo instructor)
    socket.on('start_game', async (data) => {
        try {
            const { sessionId } = data;
            
            await gameManager.startGame(sessionId);
            
            // Enviar primera pregunta
            const challenge = gameManager.challenges[0];
            io.to(sessionId).emit('game_started', {
                question: challenge,
                questionIndex: 0
            });
            
            // Iniciar timer
            gameManager.startQuestionTimer(sessionId, challenge.time);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Enviar respuesta
    socket.on('submit_answer', async (data) => {
        try {
            const { sessionId, selectedOption, responseTime } = data;
            const playerId = gameManager.playerSockets.get(socket.id);
            
            if (!playerId) {
                socket.emit('error', { message: 'Player not found' });
                return;
            }

            const sessionState = gameManager.sessions.get(sessionId);
            const questionIndex = sessionState?.currentQuestion || 0;
            
            const result = await gameManager.submitAnswer(
                sessionId, 
                playerId, 
                questionIndex, 
                selectedOption, 
                responseTime
            );
            
            socket.emit('answer_submitted', result);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Siguiente pregunta (solo instructor)
    socket.on('next_question', async (data) => {
        try {
            const { sessionId } = data;
            await gameManager.nextQuestion(sessionId);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Reiniciar juego
    socket.on('reset_game', async (data) => {
        try {
            const { sessionId } = data;
            
            // Reset en base de datos
            await supabase.from('players').update({ score: 0 }).eq('session_id', sessionId);
            await supabase.from('team_scores').update({ total_score: 0 }).eq('session_id', sessionId);
            await supabase.from('game_sessions').update({ 
                status: 'waiting', 
                current_question: 0 
            }).eq('id', sessionId);
            
            // Limpiar estado local
            const sessionState = gameManager.sessions.get(sessionId);
            if (sessionState) {
                if (sessionState.timerInterval) {
                    clearInterval(sessionState.timerInterval);
                }
                sessionState.status = 'waiting';
                sessionState.currentQuestion = 0;
                sessionState.timer = 0;
            }
            
            io.to(sessionId).emit('game_reset');
            
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Desconexión
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        
        const playerId = gameManager.playerSockets.get(socket.id);
        if (playerId) {
            try {
                await supabase
                    .from('players')
                    .update({ is_connected: false })
                    .eq('id', playerId);
                
                gameManager.playerSockets.delete(socket.id);
            } catch (error) {
                console.error('Error updating player disconnection:', error);
            }
        }
    });
});

// =============================================
// UTILIDADES
// =============================================

function generateInstructorCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// =============================================
// INICIAR SERVIDOR
// =============================================

server.listen(PORT, () => {
    console.log(`🚀 Kidney Racing Championship Server running on port ${PORT}`);
    console.log(`📡 Socket.io ready for real-time connections`);
    console.log(`🗄️ Connected to Supabase: ${process.env.SUPABASE_URL}`);
});