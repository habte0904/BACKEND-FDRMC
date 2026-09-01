import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

let io = null;

/**
 * Initialize Socket.IO with HTTP Server
 * @param {import('http').Server} server 
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authentication Middleware for WebSockets
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.id)
        .select('-passwordHash')
        .populate('organization department team')
        .lean();

      if (!user || user.status !== 'active') {
        return next(new Error('Authentication error: User invalid or inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`⚡ Socket connected: ${socket.id} (User: ${user?.fullname || user?.email})`);

    // Join default global room
    socket.join('global:dashboard');

    // Join organizational scope rooms
    if (user?.organization?._id) {
      socket.join(`org:${user.organization._id}`);
    }
    if (user?.accessLevel) {
      socket.join(`role:${user.accessLevel}`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  return io;
};

/**
 * Get active Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    console.warn('Socket.IO is not initialized yet');
  }
  return io;
};

/**
 * Emit real-time event to connected dashboard clients
 * @param {string} event 
 * @param {any} data 
 * @param {string} [room] 
 */
export const emitDashboardEvent = (event, data, room = 'global:dashboard') => {
  try {
    if (io) {
      io.to(room).emit(event, {
        timestamp: new Date().toISOString(),
        payload: data,
      });
    }
  } catch (error) {
    console.error(`Error emitting socket event ${event}:`, error.message);
  }
};
