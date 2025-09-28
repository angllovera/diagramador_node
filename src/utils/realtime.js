// src/utils/realtime.js
const { Server } = require('socket.io');

const diagramState = new Map(); // diagramId -> { version, updatedAt }

// 🔹 presencia: diagramId -> Map<socketId, { id, name, color }>
const presence = new Map();

function roomSize(io, room) {
  return io.sockets.adapter.rooms.get(room)?.size || 0;
}

function getPresenceList(diagramId) {
  const m = presence.get(diagramId);
  return m ? Array.from(m.values()) : [];
}

function setPresence(diagramId, socket, user) {
  if (!presence.has(diagramId)) presence.set(diagramId, new Map());
  presence.get(diagramId).set(socket.id, user);
}

function removePresence(diagramId, socketId) {
  const m = presence.get(diagramId);
  if (!m) return;
  m.delete(socketId);
  if (m.size === 0) presence.delete(diagramId);
}

function colorFromId(idLike) {
  const s = String(idLike || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 50%)`;
}

function initRealtime(httpServer, { cors }) {
  const io = new Server(httpServer, { cors });

  io.on('connection', (socket) => {
    // Unirse a una sala del diagrama
    socket.on('diagram:join', ({ diagramId, userId, name }) => {
      if (!diagramId) return;
      socket.join(diagramId);
      socket.data.diagramId = diagramId;
      socket.data.userId = userId;

      // 🔹 registrar presencia (solo nombre, sin correo)
      setPresence(diagramId, socket, {
        id: userId || socket.id,
        name: name || 'Usuario',
        color: colorFromId(userId || socket.id),
      });

      const peers = roomSize(io, diagramId);
      const meta = diagramState.get(diagramId) || { version: 0, updatedAt: Date.now() };

      // Respuesta al que entra
      socket.emit('diagram:joined', { diagramId, peers, version: meta.version });

      // Aviso al resto (compatibilidad con tu evento actual)
      socket.to(diagramId).emit('diagram:user:joined', { userId, peers });

      // 🔹 Enviar lista completa de presencia a todos
      io.to(diagramId).emit('diagram:presence', getPresenceList(diagramId));
    });

    // Salir explícito (opcional si usas disconnect)
    socket.on('diagram:leave', ({ diagramId }) => {
      if (!diagramId) return;
      removePresence(diagramId, socket.id);
      socket.leave(diagramId);
      const peers = roomSize(io, diagramId);
      io.to(diagramId).emit('diagram:user:left', { userId: socket.data?.userId, peers });
      io.to(diagramId).emit('diagram:presence', getPresenceList(diagramId));
    });

    // Recibir cambios y reenviar a otros
    socket.on('diagram:change', ({ diagramId, incrementalJson, modelJson, clientVersion, source }) => {
      if (!diagramId) return;
      if (!incrementalJson && !modelJson) return;

      const meta = diagramState.get(diagramId) || { version: 0, updatedAt: 0 };
      const newVersion = (meta.version || 0) + 1;
      diagramState.set(diagramId, { version: newVersion, updatedAt: Date.now() });

      const payload = { diagramId, serverVersion: newVersion, source };
      if (incrementalJson) payload.incrementalJson = incrementalJson;
      else payload.modelJson = modelJson;

      socket.to(diagramId).emit('diagram:changed', payload);
    });

    // Latido opcional
    socket.on('diagram:ping', ({ diagramId }) => {
      if (!diagramId) return;
      socket.to(diagramId).emit('diagram:pong', { at: Date.now() });
    });

    // Notificar salida con peers y presencia actualizados
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);
      for (const room of rooms) {
        removePresence(room, socket.id);
        const peers = Math.max(roomSize(io, room) - 1, 0);
        io.to(room).emit('diagram:user:left', { userId: socket.data?.userId, peers });
        io.to(room).emit('diagram:presence', getPresenceList(room));
      }
    });
  });

  console.log('🔌 Realtime habilitado con Socket.IO');
  return io;
}

module.exports = { initRealtime };
