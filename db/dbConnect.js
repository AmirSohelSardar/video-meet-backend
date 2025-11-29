import mongoose from "mongoose";

const dbConnection = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("URI:", process.env.MONGO_URI ? "Found" : "Missing");
    
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ MongoDB Connected Successfully!");
    
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:");
    console.error("Error:", error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn("⚠️ MongoDB Disconnected");
});

export default dbConnection;