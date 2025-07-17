// =============================================
// netlify/functions/join-game.js
// Version 100% fonctionnelle et testée
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
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight CORS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // GET - Récupérer l'état du jeu
        if (event.httpMethod === 'GET') {
            updateTeamsFromPlayers();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    players: gameData.players,
                    teams: gameData.teams,
                    gameStatus: gameData.gameStatus,
                    totalPlayers: gameData.players.length,
                    timestamp: Date.now()
                })
            };
        }

        // POST - Actions du jeu
        if (event.httpMethod === 'POST') {
            let requestData = {};
            
            // Parser le body de manière sécurisée
            try {
                if (event.body) {
                    requestData = JSON.parse(event.body);
                }
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Invalid JSON in request body'
                    })
                };
            }

            const { action, playerName, teamIndex, playerId } = requestData;

            // Router les actions
            switch (action) {
                case 'join':
                    return await handleJoinGame(playerName, teamIndex, headers);
                case 'leave':
                    return await handleLeaveGame(playerId, headers);
                case 'start':
                    return await handleStartGame(headers);
                case 'reset':
                    return await handleResetGame(headers);
                default:
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            success: false,
                            error: `Action inconnue: ${action}`
                        })
                    };
            }
        }

        // Méthode non supportée
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed'
            })
        };

    } catch (error) {
        console.error('Handler Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error: ' + error.message
            })
        };
    }
};

// Mettre à jour les équipes depuis les joueurs
function updateTeamsFromPlayers() {
    try {
        // Reset teams
        gameData.teams.forEach(team => {
            team.members = [];
            team.score = 0;
        });

        // Redistribuer joueurs
        gameData.players.forEach(player => {
            if (player.team !== undefined && 
                player.team >= 0 && 
                player.team < gameData.teams.length) {
                gameData.teams[player.team].members.push(player);
                gameData.teams[player.team].score += (player.score || 0);
            }
        });
    } catch (error) {
        console.error('Error updating teams:', error);
    }
}

// Gérer l'ajout d'un joueur
async function handleJoinGame(playerName, teamIndex, headers) {
    try {
        // Validations
        if (!playerName || typeof playerName !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Nombre requerido'
                })
            };
        }

        const cleanName = playerName.trim();
        if (cleanName.length < 2) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Nombre debe tener al menos 2 caracteres'
                })
            };
        }

        if (teamIndex === undefined || teamIndex < 0 || teamIndex >= gameData.teams.length) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Equipo inválido'
                })
            };
        }

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

        // Vérifier nom unique
        const existingPlayer = gameData.players.find(p => 
            p.name && p.name.toLowerCase() === cleanName.toLowerCase()
        );
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

        // Vérifier équipe pas pleine
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

        // Créer le joueur
        const player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: cleanName,
            team: teamIndex,
            score: 0,
            connected: true,
            joinedAt: new Date().toISOString()
        };

        // Ajouter le joueur
        gameData.players.push(player);
        updateTeamsFromPlayers();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                player: player,
                teams: gameData.teams,
                totalPlayers: gameData.players.length,
                message: 'Jugador añadido exitosamente'
            })
        };

    } catch (error) {
        console.error('Error in handleJoinGame:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor'
            })
        };
    }
}

// Gérer la sortie d'un joueur
async function handleLeaveGame(playerId, headers) {
    try {
        if (!playerId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'ID de jugador requerido'
                })
            };
        }

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

        // Si plus aucun joueur, reset
        if (gameData.players.length === 0) {
            gameData.gameStatus = 'waiting';
            gameData.currentQuestion = 0;
        }

        updateTeamsFromPlayers();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Jugador retirado exitosamente',
                teams: gameData.teams,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        console.error('Error in handleLeaveGame:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor'
            })
        };
    }
}

// Démarrer le jeu
async function handleStartGame(headers) {
    try {
        if (gameData.players.length < 1) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Se necesita al menos 1 jugador para iniciar'
                })
            };
        }

        gameData.gameStatus = 'playing';
        gameData.currentQuestion = 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Juego iniciado exitosamente',
                gameStatus: gameData.gameStatus,
                totalPlayers: gameData.players.length
            })
        };

    } catch (error) {
        console.error('Error in handleStartGame:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor'
            })
        };
    }
}

// Reset du jeu
async function handleResetGame(headers) {
    try {
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
                message: 'Juego reiniciado exitosamente'
            })
        };

    } catch (error) {
        console.error('Error in handleResetGame:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor'
            })
        };
    }
}