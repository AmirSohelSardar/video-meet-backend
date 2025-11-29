import mongoose from "mongoose";

const dbConnection = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("MONGO_URI:", process.env.MONGO_URI ? "✅ Found" : "❌ Missing");
    
    // ✅ Updated connection options for better stability
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // Timeout for selecting a server
      socketTimeoutMS: 45000, // Timeout for socket inactivity
      maxPoolSize: 10, // Maximum connection pool size
      minPoolSize: 2, // Minimum connection pool size
      retryWrites: true,
      retryReads: true,
    });
    
    console.log("✅ MongoDB Connected Successfully!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    // ✅ Set mongoose buffer timeout
    mongoose.set('bufferTimeoutMS', 30000);
    
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:");
    console.error("Error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

// ✅ Add connection event listeners
mongoose.connection.on('connected', () => {
  console.log("📡 Mongoose connected to MongoDB");
});

mongoose.connection.on('disconnected', () => {
  console.warn("⚠️ MongoDB Disconnected - attempting to reconnect...");
});

mongoose.connection.on('error', (err) => {
  console.error("❌ MongoDB Error:", err);
});

mongoose.connection.on('reconnected', () => {
  console.log("🔄 MongoDB Reconnected");
});

export default dbConnection;