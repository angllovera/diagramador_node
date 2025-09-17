// src/utils/realtime.js
const { Server } = require('socket.io');

const diagramState = new Map(); // diagramId -> { version, updatedAt }

function roomSize(io, room) {
  return io.sockets.adapter.rooms.get(room)?.size || 0;
}

function initRealtime(httpServer, { cors }) {
  const io = new Server(httpServer, { cors });

  io.on('connection', (socket) => {
    // Unirse a una sala del diagrama
    socket.on('diagram:join', ({ diagramId, userId }) => {
      if (!diagramId) return;
      socket.join(diagramId);
      socket.data.diagramId = diagramId;
      socket.data.userId = userId;

      const peers = roomSize(io, diagramId);
      const meta = diagramState.get(diagramId) || { version: 0, updatedAt: Date.now() };

      // Respuesta al que entra
      socket.emit('diagram:joined', { diagramId, peers, version: meta.version });
      // Aviso al resto
      socket.to(diagramId).emit('diagram:user:joined', { userId, peers });
    });

    // Recibir cambios y reenviar a otros (incremental preferido; legacy full permitido)
    socket.on('diagram:change', ({ diagramId, incrementalJson, modelJson, clientVersion, source }) => {
      if (!diagramId) return;
      if (!incrementalJson && !modelJson) return;

      const meta = diagramState.get(diagramId) || { version: 0, updatedAt: 0 };
      const newVersion = (meta.version || 0) + 1;
      diagramState.set(diagramId, { version: newVersion, updatedAt: Date.now() });

      const payload = {
        diagramId,
        serverVersion: newVersion,
        source, // para que el emisor se ignore a sí mismo
      };
      if (incrementalJson) payload.incrementalJson = incrementalJson;
      else payload.modelJson = modelJson; // fallback legacy

      socket.to(diagramId).emit('diagram:changed', payload);
    });

    // Latido opcional
    socket.on('diagram:ping', ({ diagramId }) => {
      if (!diagramId) return;
      socket.to(diagramId).emit('diagram:pong', { at: Date.now() });
    });

    // Notificar salida con peers actualizados
    socket.on('disconnecting', () => {
      // todas las rooms excepto el id propio del socket
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);
      for (const room of rooms) {
        const peers = Math.max(roomSize(io, room) - 1, 0);
        io.to(room).emit('diagram:user:left', {
          userId: socket.data?.userId,
          peers,
        });
      }
    });
  });

  console.log('🔌 Realtime habilitado con Socket.IO');
  return io;
}

module.exports = { initRealtime };
