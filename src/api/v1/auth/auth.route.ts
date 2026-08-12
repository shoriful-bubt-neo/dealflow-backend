import { Router } from "express";
import {
  handleGetCurrentUser,
  handleLogin,
  handleLogout,
  handleRegister,
  handleVerifyOtp,
} from "./auth.controller.js";
import { loginSchema, registerSchema, verifyOtpSchema } from "./auth.validation.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { protectRoute } from "../../../middlewares/auth.js";

const router = Router();

router.post("/register", validateRequest(registerSchema), handleRegister);
router.post("/verify-otp", validateRequest(verifyOtpSchema), handleVerifyOtp);
router.post("/login", validateRequest(loginSchema), handleLogin);
router.post("/logout", handleLogout);
router.get("/me", protectRoute, handleGetCurrentUser);

export default router;
