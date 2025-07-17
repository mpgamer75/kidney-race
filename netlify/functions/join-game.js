// =============================================
// netlify/functions/join-game.js
// Fonction avec synchronisation temps réel
// =============================================

// Base de données simulée avec état de jeu partagé
let gameData = {
    players: [],
    gameStatus: 'waiting', // waiting, playing, finished
    currentQuestion: 0,
    questionStartTime: null,
    playersAnswered: new Set(), // IDs des joueurs qui ont répondu
    currentQuestionData: null,
    teams: [
        { name: 'RIÑÓN ROJO', emoji: '🏎️', members: [], score: 0 },
        { name: 'AZUL NEFRÓN', emoji: '🏁', members: [], score: 0 },
        { name: 'AMARILLO FILTRO', emoji: '🚗', members: [], score: 0 },
        { name: 'VERDE HOMEOSTASIS', emoji: '🏎️', members: [], score: 0 },
        { name: 'PÚRPURA UREA', emoji: '🏁', members: [], score: 0 }
    ],
    challenges: [
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
        }
    ]
};

// Timer global pour les questions
let questionTimer = null;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { httpMethod, body } = event;

        if (httpMethod === 'GET') {
            // Obtenir état complet du jeu
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    players: gameData.players,
                    teams: gameData.teams,
                    gameStatus: gameData.gameStatus,
                    currentQuestion: gameData.currentQuestion,
                    currentQuestionData: gameData.currentQuestionData,
                    questionStartTime: gameData.questionStartTime,
                    playersAnswered: Array.from(gameData.playersAnswered),
                    totalPlayers: gameData.players.length,
                    timestamp: Date.now()
                })
            };
        }

        if (httpMethod === 'POST') {
            const { action, playerName, teamIndex, answer, playerId, questionIndex } = JSON.parse(body);

            switch (action) {
                case 'join':
                    return handleJoinGame(playerName, teamIndex, headers);
                case 'leave':
                    return handleLeaveGame(playerId, headers);
                case 'start':
                    return handleStartGame(headers);
                case 'answer':
                    return handleSubmitAnswer(playerId, answer, questionIndex, headers);
                case 'next-question':
                    return handleNextQuestion(headers);
                case 'reset':
                    return handleResetGame(headers);
                default:
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Action inconnue' })
                    };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function updateTeamsFromPlayers() {
    // Reset teams
    gameData.teams.forEach(team => {
        team.members = [];
        team.score = 0;
    });

    // Redistribuer joueurs
    gameData.players.forEach(player => {
        if (player.team !== undefined && player.team < gameData.teams.length) {
            gameData.teams[player.team].members.push(player);
            gameData.teams[player.team].score += player.score || 0;
        }
    });
}

function handleJoinGame(playerName, teamIndex, headers) {
    try {
        // Vérifications
        if (gameData.players.length >= 17) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Sala completa (máximo 17 jugadores)' })
            };
        }

        const existingPlayer = gameData.players.find(p => p.name === playerName);
        if (existingPlayer) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Ese nombre ya está en uso' })
            };
        }

        const teamPlayers = gameData.players.filter(p => p.team === teamIndex);
        if (teamPlayers.length >= 4) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Equipo completo (máximo 4 por equipo)' })
            };
        }

        // Créer joueur
        const player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: playerName,
            team: teamIndex,
            score: 0,
            connected: true,
            joinedAt: new Date().toISOString(),
            lastAnswer: null
        };

        gameData.players.push(player);
        updateTeamsFromPlayers();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                player: player,
                teams: gameData.teams,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

function handleLeaveGame(playerId, headers) {
    try {
        const playerIndex = gameData.players.findIndex(p => p.id === playerId);
        
        if (playerIndex === -1) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Jugador no encontrado' })
            };
        }

        // Retirer le joueur
        gameData.players.splice(playerIndex, 1);
        gameData.playersAnswered.delete(playerId);

        // Si plus aucun joueur, reset complet
        if (gameData.players.length === 0) {
            handleResetGame(headers);
        } else {
            updateTeamsFromPlayers();
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Jugador retirado',
                teams: gameData.teams,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

function handleStartGame(headers) {
    try {
        if (gameData.players.length < 1) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Se necesita al menos 1 jugador' })
            };
        }

        // Démarrer le jeu
        gameData.gameStatus = 'playing';
        gameData.currentQuestion = 0;
        gameData.playersAnswered.clear();
        
        // Préparer première question
        const firstQuestion = gameData.challenges[0];
        gameData.currentQuestionData = firstQuestion;
        gameData.questionStartTime = Date.now();

        // Démarrer timer automatique pour cette question
        startQuestionTimer(firstQuestion.time);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Juego iniciado',
                gameStatus: gameData.gameStatus,
                currentQuestionData: gameData.currentQuestionData,
                questionStartTime: gameData.questionStartTime,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

function handleSubmitAnswer(playerId, answer, questionIndex, headers) {
    try {
        const player = gameData.players.find(p => p.id === playerId);
        if (!player) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Jugador no encontrado' })
            };
        }

        // Vérifier que c'est la bonne question
        if (questionIndex !== gameData.currentQuestion) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Question incorrecte' })
            };
        }

        // Vérifier que le joueur n'a pas déjà répondu
        if (gameData.playersAnswered.has(playerId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Ya has respondido a esta pregunta' })
            };
        }

        const challenge = gameData.challenges[gameData.currentQuestion];
        const isCorrect = answer === challenge.correct;
        
        // Calculer points en fonction du temps de réponse
        let points = 0;
        if (isCorrect) {
            const timeElapsed = (Date.now() - gameData.questionStartTime) / 1000;
            const timeBonus = Math.max(0, (challenge.time - timeElapsed) / challenge.time);
            points = Math.round(challenge.points * (0.5 + 0.5 * timeBonus));
            
            player.score += points;
        }

        player.lastAnswer = {
            questionIndex,
            answer,
            isCorrect,
            points,
            answeredAt: Date.now()
        };

        // Marquer comme ayant répondu
        gameData.playersAnswered.add(playerId);

        // Mettre à jour scores des équipes
        updateTeamsFromPlayers();

        // Vérifier si tous ont répondu ou si on doit avancer
        checkIfShouldAdvance();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                isCorrect,
                points,
                newScore: player.score,
                teams: gameData.teams,
                playersAnswered: gameData.playersAnswered.size,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

function handleNextQuestion(headers) {
    try {
        gameData.currentQuestion++;
        
        if (gameData.currentQuestion < gameData.challenges.length) {
            // Question suivante
            const nextQuestion = gameData.challenges[gameData.currentQuestion];
            gameData.currentQuestionData = nextQuestion;
            gameData.questionStartTime = Date.now();
            gameData.playersAnswered.clear();
            
            // Reset lastAnswer pour tous
            gameData.players.forEach(player => {
                player.lastAnswer = null;
            });

            startQuestionTimer(nextQuestion.time);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    currentQuestion: gameData.currentQuestion,
                    currentQuestionData: gameData.currentQuestionData,
                    questionStartTime: gameData.questionStartTime
                })
            };
        } else {
            // Fin du jeu
            gameData.gameStatus = 'finished';
            gameData.currentQuestionData = null;
            
            if (questionTimer) {
                clearTimeout(questionTimer);
                questionTimer = null;
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    gameStatus: 'finished',
                    finalTeams: gameData.teams
                })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

function startQuestionTimer(duration) {
    // Nettoyer timer précédent
    if (questionTimer) {
        clearTimeout(questionTimer);
    }

    // Timer automatique
    questionTimer = setTimeout(() => {
        console.log('Timer écoulé, passage à la question suivante');
        handleNextQuestion({ 'Content-Type': 'application/json' });
    }, duration * 1000);
}

function checkIfShouldAdvance() {
    // Avancer si tous les joueurs connectés ont répondu
    const connectedPlayers = gameData.players.filter(p => p.connected);
    
    if (gameData.playersAnswered.size >= connectedPlayers.length && connectedPlayers.length > 0) {
        // Tous ont répondu, on attend 3 secondes pour montrer la réponse puis on avance
        setTimeout(() => {
            handleNextQuestion({ 'Content-Type': 'application/json' });
        }, 3000);
    }
}

function handleResetGame(headers) {
    try {
        // Nettoyer timer
        if (questionTimer) {
            clearTimeout(questionTimer);
            questionTimer = null;
        }

        // Reset complet
        gameData = {
            players: [],
            gameStatus: 'waiting',
            currentQuestion: 0,
            questionStartTime: null,
            playersAnswered: new Set(),
            currentQuestionData: null,
            teams: [
                { name: 'RIÑÓN ROJO', emoji: '🏎️', members: [], score: 0 },
                { name: 'AZUL NEFRÓN', emoji: '🏁', members: [], score: 0 },
                { name: 'AMARILLO FILTRO', emoji: '🚗', members: [], score: 0 },
                { name: 'VERDE HOMEOSTASIS', emoji: '🏎️', members: [], score: 0 },
                { name: 'PÚRPURA UREA', emoji: '🏁', members: [], score: 0 }
            ],
            challenges: gameData.challenges // Garder les questions
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Juego reiniciado'
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}