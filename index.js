// Import required modules
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose"; // ✅ ADDED: Missing import!

// Import custom route files
import authRoute from "./rout/authRout.js";
import userRoute from "./rout/userRout.js";
import dbConnection from "./db/dbConnect.js";

// ✅ Load environment variables FIRST
dotenv.config();

// 🌍 Create an Express application
const app = express(); 

// 🔧 Set up server port
const PORT = process.env.PORT || 3000;

// 📡 Create an HTTP server
const server = createServer(app);

// 🌍 Allowed frontend origins for CORS - ✅ FIXED: Removed duplicates
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://video-meet-frontend-kappa.vercel.app",
  process.env.FRONTEND_URL
].filter((origin, index, self) => 
  origin && self.indexOf(origin) === index // Remove duplicates and null/undefined
);

// ✅ Trust proxy (required for Vercel)
app.set('trust proxy', 1);

// ✅ SIMPLIFIED CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
}));

// ✅ Handle preflight requests explicitly
app.options('*', cors());

// ✅ Add CORS headers middleware (backup)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// 🔧 Parse JSON and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 📍 API Routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);

// 🏠 Test route
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Backend is running!",
    timestamp: new Date().toISOString()
  });
});

// ✅ Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongooseReady: mongoose.connection.readyState === 1
  });
});

// 🔌 Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

console.log("[SUCCESS] Socket.io initialized with CORS");

// 🟢 Store online users and active calls
let onlineUsers = [];
const activeCalls = new Map();

// 📞 Handle WebSocket connections
io.on("connection", (socket) => {
  console.log(`[INFO] New connection: ${socket.id}`);

  socket.emit("me", socket.id);

  socket.on("join", (user) => {
    if (!user || !user.id) {
      console.warn("[WARNING] Invalid user data on join");
      return;
    }

    socket.join(user.id);
    const existingUser = onlineUsers.find((u) => u.userId === user.id);

    if (existingUser) {
      existingUser.socketId = socket.id;
    } else {
      onlineUsers.push({
        userId: user.id,
        name: user.name,
        socketId: socket.id,
      });
    }

    io.emit("online-users", onlineUsers);
    console.log(`[INFO] User ${user.name} joined. Online users: ${onlineUsers.length}`);
  });

  socket.on("callToUser", (data) => {
    const callee = onlineUsers.find((user) => user.userId === data.callToUserId);

    if (!callee) {
      socket.emit("userUnavailable", { message: "User is offline." });
      return;
    }

    if (activeCalls.has(data.callToUserId)) {
      socket.emit("userBusy", { message: "User is currently in another call." });

      io.to(callee.socketId).emit("incomingCallWhileBusy", {
        from: data.from,
        name: data.name,
        email: data.email,
        profilepic: data.profilepic,
      });

      return;
    }

    io.to(callee.socketId).emit("callToUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name,
      email: data.email,
      profilepic: data.profilepic,
    });
  });

  socket.on("answeredCall", (data) => {
    io.to(data.to).emit("callAccepted", {
      signal: data.signal,
      from: data.from,
    });

    activeCalls.set(data.from, { with: data.to, socketId: socket.id });
    activeCalls.set(data.to, { with: data.from, socketId: data.to });
  });

  socket.on("reject-call", (data) => {
    io.to(data.to).emit("callRejected", {
      name: data.name,
      profilepic: data.profilepic
    });
  });

  socket.on("call-ended", (data) => {
    io.to(data.to).emit("callEnded", {
      name: data.name,
    });

    activeCalls.delete(data.from);
    activeCalls.delete(data.to);
  });

  socket.on("screenShareStarted", (data) => {
    io.to(data.to).emit("screenShareStarted", {
      from: socket.id
    });
    console.log(`[INFO] User ${socket.id} started screen sharing with ${data.to}`);
  });

  socket.on("screenShareStopped", (data) => {
    io.to(data.to).emit("screenShareStopped", {
      from: socket.id
    });
    console.log(`[INFO] User ${socket.id} stopped screen sharing with ${data.to}`);
  });

  socket.on("send-message", (data) => {
    io.to(data.to).emit("receive-message", {
      from: socket.id,
      message: data.message,
      sender: data.sender,
      timestamp: data.timestamp
    });
    console.log(`[INFO] Message sent from ${data.sender} to ${data.to}`);
  });

  socket.on("youtube-load", (data) => {
    io.to(data.to).emit("youtube-load", {
      from: socket.id,
      videoId: data.videoId
    });
    console.log(`[INFO] YouTube video ${data.videoId} loaded by ${socket.id}`);
  });

  socket.on("youtube-play", (data) => {
    io.to(data.to).emit("youtube-play", {
      from: socket.id,
      isPlaying: data.isPlaying,
      currentTime: data.currentTime
    });
    console.log(`[INFO] YouTube ${data.isPlaying ? 'played' : 'paused'} by ${socket.id}`);
  });

  socket.on("youtube-seek", (data) => {
    io.to(data.to).emit("youtube-seek", {
      from: socket.id,
      currentTime: data.currentTime
    });
    console.log(`[INFO] YouTube seeked to ${data.currentTime} by ${socket.id}`);
  });

  socket.on("youtube-sync", (data) => {
    io.to(data.to).emit("youtube-sync", {
      from: socket.id,
      videoId: data.videoId,
      currentTime: data.currentTime,
      isPlaying: data.isPlaying
    });
  });

  socket.on("music-load", (data) => {
    io.to(data.to).emit("music-load", {
      from: socket.id,
      audioUrl: data.audioUrl
    });
    console.log(`[INFO] Music loaded by ${socket.id}`);
  });

  socket.on("music-play", (data) => {
    io.to(data.to).emit("music-play", {
      from: socket.id,
      isPlaying: data.isPlaying,
      currentTime: data.currentTime
    });
    console.log(`[INFO] Music ${data.isPlaying ? 'played' : 'paused'} by ${socket.id}`);
  });

  socket.on("music-seek", (data) => {
    io.to(data.to).emit("music-seek", {
      from: socket.id,
      currentTime: data.currentTime
    });
    console.log(`[INFO] Music seeked to ${data.currentTime} by ${socket.id}`);
  });

  socket.on("music-volume", (data) => {
    io.to(data.to).emit("music-volume", {
      from: socket.id,
      volume: data.volume
    });
    console.log(`[INFO] Music volume changed to ${data.volume} by ${socket.id}`);
  });

  socket.on("disconnect", () => {
    const user = onlineUsers.find((u) => u.socketId === socket.id);
    if (user) {
      activeCalls.delete(user.userId);

      for (const [key, value] of activeCalls.entries()) {
        if (value.with === user.userId) activeCalls.delete(key);
      }
      
      for (const onlineUser of onlineUsers) {
        if (onlineUser.userId !== user.userId) {
          io.to(onlineUser.socketId).emit("peer-disconnected", {
            userId: user.userId
          });
        }
      }
    }

    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("online-users", onlineUsers);
    socket.broadcast.emit("discounnectUser", { disUser: socket.id });

    console.log(`[INFO] Disconnected: ${socket.id}. Online users: ${onlineUsers.length}`);
  });
});

// ❌ Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// 🏁 Start the server - ✅ CRITICAL: Connect to DB BEFORE starting server
(async () => {
  try {
    // ✅ WAIT for database connection to be fully established
    await dbConnection();
    
    // ✅ Verify connection is ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready after connection attempt');
    }
    
    // ✅ Add a small delay to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
      console.log(`✅ MongoDB Connection State: ${mongoose.connection.readyState} (1 = Connected)`);
      console.log(`✅ Database Name: ${mongoose.connection.db?.databaseName || 'Not available'}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});