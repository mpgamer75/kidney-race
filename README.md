# 🏁 Kidney Racing Championship

Juego educativo multijugador en tiempo real sobre el sistema renal, estilo Kahoot.

## 🎮 Características

- **Multijugador en tiempo real** con Socket.io
- **5 equipos de hasta 4 jugadores** cada uno
- **Preguntas educativas** sobre nefrología
- **Sistema de puntuación** en tiempo real
- **Control de instructor** para gestionar el juego

## 🚀 Arquitectura

```
👥 ESTUDIANTES → 🌐 FRONTEND (Vercel) → 🚀 BACKEND (Railway) → 🗄️ DATABASE (Supabase)
```

## 📁 Estructura

```
kidney-racing-championship/
├── frontend/          # Frontend estático (Vercel)
├── backend/           # Servidor Node.js (Railway)
├── schema.sql         # Esquema de base de datos
└── README.md         # Este archivo
```

## 🎯 Uso Rápido

### Como Instructor

1. Abre: `https://kidney-racing.vercel.app?admin=true`
2. Se genera código de sesión (ej: ABC123)
3. Comparte: `https://kidney-racing.vercel.app?code=ABC123`

### Como Estudiante

1. Abre el enlace con código
2. Ingresa tu nombre
3. Selecciona equipo
4. ¡A jugar!

## 🛠 Configuración

Ver `/backend/README.md` y `/frontend/README.md` para instrucciones detalladas.

## 📊 Stack Tecnológico

- **Frontend**: HTML, CSS, JavaScript, Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Base de Datos**: Supabase (PostgreSQL)
- **Deploy**: Vercel (Frontend) + Railway (Backend)

---

Desarrollado para educación médica interactiva 🫘
