// =============================================
// netlify/functions/join-game.js
// Fonction unique pour tout gérer
// =============================================

// Base de données simulée (en production, utilise Supabase)
let gameData = {
    players: [],
    gameStatus: 'waiting', // waiting, playing, finished
    currentQuestion: 0
};

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
            // Obtenir état du jeu
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    players: gameData.players,
                    gameStatus: gameData.gameStatus,
                    currentQuestion: gameData.currentQuestion,
                    totalPlayers: gameData.players.length
                })
            };
        }

        if (httpMethod === 'POST') {
            const { action, playerName, teamIndex, answer, playerId } = JSON.parse(body);

            switch (action) {
                case 'join':
                    return handleJoinGame(playerName, teamIndex, headers);
                case 'leave':
                    return handleLeaveGame(playerId, headers);
                case 'start':
                    return handleStartGame(headers);
                case 'answer':
                    return handleSubmitAnswer(playerId, answer, headers);
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

        // Crear jugador
        const player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: playerName,
            team: teamIndex,
            score: 0,
            connected: true,
            joinedAt: new Date().toISOString()
        };

        gameData.players.push(player);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                player: player,
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

        // Si plus aucun joueur, reset complet
        if (gameData.players.length === 0) {
            gameData = {
                players: [],
                gameStatus: 'waiting',
                currentQuestion: 0
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Jugador retirado',
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

        gameData.gameStatus = 'playing';
        gameData.currentQuestion = 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Juego iniciado',
                gameStatus: gameData.gameStatus,
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

function handleSubmitAnswer(playerId, answer, headers) {
    try {
        const player = gameData.players.find(p => p.id === playerId);
        if (!player) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Jugador no encontrado' })
            };
        }

        // Aquí podrías validar la respuesta y asignar puntos
        // Para simplificar, asumimos que todas las respuestas dan puntos
        const points = Math.floor(Math.random() * 20) + 10; // 10-30 puntos aleatorios
        player.score += points;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                points: points,
                newScore: player.score
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

function handleResetGame(headers) {
    try {
        // Reset complet
        gameData = {
            players: [],
            gameStatus: 'waiting',
            currentQuestion: 0
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