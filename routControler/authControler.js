import User from "../schema/userSchema.js"
import bcrypt from "bcryptjs"
import jwtToken from "../utils/jwtToken.js";
import mongoose from "mongoose";

export const SignUp = async (req, res) => {
    try {
        // ✅ Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "Database connection not ready. Please try again."
            });
        }

        const { fullname, username, email, password, gender, profilepic } = req.body;
        
        // Validate required fields
        if (!fullname || !username || !email || !password || !gender) {
            return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Check if username exists
        const user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ 
                success: false, 
                message: "Username already exists" 
            });
        }

        // Check if email exists
        const emailPresent = await User.findOne({ email });
        if (emailPresent) {
            return res.status(400).json({ 
                success: false, 
                message: "User already exists with this email" 
            });
        }

        // Hash password
        const hashPassword = bcrypt.hashSync(password, 10);
        
        // Use uploaded profile pic or generate default avatar
        let userProfilePic = profilepic;
        
        if (!userProfilePic || userProfilePic.trim() === '') {
            // Generate default avatar if no image uploaded
            const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${username}`;
            const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${username}`;
            userProfilePic = gender === "male" ? boyProfilePic : girlProfilePic;
        }

        // Create new user
        const newUser = new User({
            fullname,
            username,
            email,
            password: hashPassword,
            gender,
            profilepic: userProfilePic
        });

        // Save user
        await newUser.save();
        
        // Generate JWT token
        const token = jwtToken(newUser._id, res);

        // ✅ FIXED: Return response with user object
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                _id: newUser._id,
                fullname: newUser.fullname,
                username: newUser.username,
                profilepic: newUser.profilepic,
                email: newUser.email,
            },
            token
        });

    } catch (error) {
        console.error("SignUp Error:", error);
        
        // Handle specific MongoDB errors
        if (error.name === 'MongoTimeoutError' || error.name === 'MongoNetworkError') {
            return res.status(503).json({
                success: false,
                message: "Database connection timeout. Please try again."
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}

export const Login = async (req, res) => {
    try {
        // ✅ Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "Database connection not ready. Please try again."
            });
        }

        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and password are required" 
            });
        }

        // Find user
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: "Email doesn't exist. Please register first." 
            });
        }

        // Compare password
        const comparePassword = bcrypt.compareSync(password, user.password || "");
        if (!comparePassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Email or password doesn't match" 
            });
        }

        // Generate JWT token
        const token = jwtToken(user._id, res);

        // ✅ FIXED: Return response with user object (don't send password)
        res.status(200).json({
            success: true,
            message: "Successfully logged in",
            user: {
                _id: user._id,
                fullname: user.fullname,
                username: user.username,
                profilepic: user.profilepic,
                email: user.email,
            },
            token
        });

    } catch (error) {
        console.error("Login Error:", error);
        
        // Handle specific MongoDB errors
        if (error.name === 'MongoTimeoutError' || error.name === 'MongoNetworkError') {
            return res.status(503).json({
                success: false,
                message: "Database connection timeout. Please try again."
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}

export const LogOut = async (req, res) => {
    try {
        res.clearCookie('jwt', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        });
        
        res.status(200).json({ 
            success: true, 
            message: "User logged out successfully" 
        });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}