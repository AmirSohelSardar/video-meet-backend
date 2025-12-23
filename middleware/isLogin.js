import jwt from 'jsonwebtoken';
import User from '../schema/userSchema.js';

const isLogin = async (req, res, next) => {
    try {
      // ✅ FIX: Check Authorization header FIRST (since frontend uses this)
const authHeader = req.headers.authorization;
const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : req.cookies.jwt || 
      req.headers?.cookie
          ?.split("; ")
          .find((cookie) => cookie.startsWith("jwt="))
          ?.split("=")[1];

// ✅ ADD: Debug logging
console.log('isLogin check - Has Authorization header:', !!authHeader);
console.log('isLogin check - Has cookie:', !!req.cookies.jwt);
console.log('isLogin check - Token found:', !!token);

if (!token) {
    return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
    });
}

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded?.userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - Invalid token",
            });
        }

        // ✅ FIX: Properly fetch user
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        req.user = user; // ✅ This is the fix!
        next();

    } catch (error) {
        console.error("isLogin Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export default isLogin;