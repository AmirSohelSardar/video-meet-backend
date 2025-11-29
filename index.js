// Import required modules
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

// Import custom route files
import authRoute from "./rout/authRout.js";
import userRoute from "./rout/userRout.js";
import dbConnection from "./db/dbConnect.js";

// ✅ Load environment variables
dotenv.config();

// 🌍 Create an Express application
const app = express(); 

// 🔧 Set up server port
const PORT = process.env.PORT || 3000;

// 📡 Create an HTTP server
const server = createServer(app);

// 🌍 Allowed frontend origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://video-meet-frontend-kappa.vercel.app"   // ✅ Your real Vercel frontend
];

// 🔧 Middleware to handle CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// 🛠 Middleware for handling JSON requests and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// 🔗 Define API routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);

// ✅ Test Route
app.get("/ok", (req, res) => {
  res.json({ message: "Server is running!" });
});

// 🔥 Initialize Socket.io
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
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

  // 📴 Handle call ending
  socket.on("call-ended", (data) => {
    io.to(data.to).emit("callEnded", {
      name: data.name,
    });

    activeCalls.delete(data.from);
    activeCalls.delete(data.to);
  });

  // 🖥️ Screen sharing events
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

  // 💬 LIVE CHAT EVENTS
  socket.on("send-message", (data) => {
    io.to(data.to).emit("receive-message", {
      from: socket.id,
      message: data.message,
      sender: data.sender,
      timestamp: data.timestamp
    });
    console.log(`[INFO] Message sent from ${data.sender} to ${data.to}`);
  });

  // 🎬 YOUTUBE WATCH PARTY EVENTS
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

  // ✅ NEW: YouTube sync event for continuous synchronization
  socket.on("youtube-sync", (data) => {
    io.to(data.to).emit("youtube-sync", {
      from: socket.id,
      videoId: data.videoId,
      currentTime: data.currentTime,
      isPlaying: data.isPlaying
    });
    console.log(`[INFO] YouTube synced at ${data.currentTime}s by ${socket.id}`);
  });

  // 🎵 MUSIC PLAYER EVENTS
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

  // ❌ Handle user disconnecting - SINGLE HANDLER ONLY
  socket.on("disconnect", () => {
    const user = onlineUsers.find((u) => u.socketId === socket.id);
    if (user) {
      activeCalls.delete(user.userId);

      for (const [key, value] of activeCalls.entries()) {
        if (value.with === user.userId) activeCalls.delete(key);
      }
      
      // Notify other user about media session end
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

    console.log(`[INFO] Disconnected: ${socket.id}`);
  });
});

// 🏁 Start the server
(async () => {
  try {
    await dbConnection();
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
    process.exit(1);
  }
})();