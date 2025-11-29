import User from "../schema/userSchema.js"
import bcrypt from "bcryptjs"
import jwtToken from "../utils/jwtToken.js";

export const SignUp = async (req, res) => {
    try {
        const { fullname, username, email, password, gender, profilepic } = req.body;
        
        // Validate required fields
        if (!fullname || !username || !email || !password || !gender) {
            return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
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

        // Return response
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            _id: newUser._id,
            fullname: newUser.fullname,
            username: newUser.username,
            profilepic: newUser.profilepic,
            email: newUser.email,
            token
        });

    } catch (error) {
        console.error("SignUp Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}

export const Login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and password are required" 
            });
        }

        // Find user
        const user = await User.findOne({ email });
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

        // Return response
        res.status(200).json({
            success: true,
            message: "Successfully logged in",
            _id: user._id,
            fullname: user.fullname,
            username: user.username,
            profilepic: user.profilepic,
            email: user.email,
            token
        });

    } catch (error) {
        console.error("Login Error:", error);
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