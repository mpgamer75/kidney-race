// =============================================
// netlify/functions/join-game.js
// Version simplifiée et corrigée
// =============================================

// Base de données simulée
let gameData = {
    players: [],
    gameStatus: 'waiting',
    currentQuestion: 0,
    teams: [
        { name: 'RIÑÓN ROJO', emoji: '🏎️', members: [], score: 0 },
        { name: 'AZUL NEFRÓN', emoji: '🏁', members: [], score: 0 },
        { name: 'AMARILLO FILTRO', emoji: '🚗', members: [], score: 0 },
        { name: 'VERDE HOMEOSTASIS', emoji: '🏎️', members: [], score: 0 },
        { name: 'PÚRPURA UREA', emoji: '🏁', members: [], score: 0 }
    ]
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
        if (event.httpMethod === 'GET') {
            // Mettre à jour les équipes depuis les joueurs
            updateTeamsFromPlayers();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    players: gameData.players,
                    teams: gameData.teams,
                    gameStatus: gameData.gameStatus,
                    totalPlayers: gameData.players.length
                })
            };
        }

        if (event.httpMethod === 'POST') {
            const { action, playerName, teamIndex, playerId } = JSON.parse(body || '{}');

            switch (action) {
                case 'join':
                    return handleJoinGame(playerName, teamIndex, headers);
                case 'leave':
                    return handleLeaveGame(playerId, headers);
                case 'start':
                    return handleStartGame(headers);
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
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Sala completa (máximo 17 jugadores)' 
                })
            };
        }

        if (!playerName || playerName.trim().length < 2) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Nombre debe tener al menos 2 caracteres' 
                })
            };
        }

        const existingPlayer = gameData.players.find(p => p.name === playerName.trim());
        if (existingPlayer) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Ese nombre ya está en uso' 
                })
            };
        }

        const teamPlayers = gameData.players.filter(p => p.team === teamIndex);
        if (teamPlayers.length >= 4) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Equipo completo (máximo 4 por equipo)' 
                })
            };
        }

        // Crear jugador
        const player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: playerName.trim(),
            team: teamIndex,
            score: 0,
            connected: true,
            joinedAt: new Date().toISOString()
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
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
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
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Jugador no encontrado' 
                })
            };
        }

        // Retirer le joueur
        gameData.players.splice(playerIndex, 1);

        // Si plus aucun joueur, reset complet
        if (gameData.players.length === 0) {
            gameData.gameStatus = 'waiting';
        }

        updateTeamsFromPlayers();

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
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
}

function handleStartGame(headers) {
    try {
        if (gameData.players.length < 1) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Se necesita al menos 1 jugador' 
                })
            };
        }

        gameData.gameStatus = 'playing';

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
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
}

function handleResetGame(headers) {
    try {
        // Reset complet
        gameData = {
            players: [],
            gameStatus: 'waiting',
            currentQuestion: 0,
            teams: [
                { name: 'RIÑÓN ROJO', emoji: '🏎️', members: [], score: 0 },
                { name: 'AZUL NEFRÓN', emoji: '🏁', members: [], score: 0 },
                { name: 'AMARILLO FILTRO', emoji: '🚗', members: [], score: 0 },
                { name: 'VERDE HOMEOSTASIS', emoji: '🏎️', members: [], score: 0 },
                { name: 'PÚRPURA UREA', emoji: '🏁', members: [], score: 0 }
            ]
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
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
}