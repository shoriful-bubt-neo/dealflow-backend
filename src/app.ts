import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import roleRoutes from "./api/v1/role/role.route.js";
import userRoutes from "./api/v1/user/user.route.js";
import paymentMethodRoutes from "./api/v1/paymentMethod/paymentMethod.route.js";
import serviceChargeConfigRoutes from "./api/v1/serviceChargeConfig/serviceChargeConfig.route.js";
import dealRoutes from "./api/v1/deal/deal.route.js";
import authRoutes from "./api/v1/auth/auth.route.js";
import uploadRoutes from "./api/v1/uploads/upload.route.js";
import kycRoutes from "./api/v1/kyc/kyc.route.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import { authenticateToken } from "./middlewares/auth.js";

const app = express();
app.set("trust proxy", true);

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Auth middleware for all routes
app.use(authenticateToken);

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/payment-methods", paymentMethodRoutes);
app.use("/api/v1/service-charge-configs", serviceChargeConfigRoutes);
app.use("/api/v1/deals", dealRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/kyc", kycRoutes);

// middlewares
app.use(globalErrorHandler);

// starting point
app.get("/", (req, res) => {
    res.send("DealFlow API running...");
});

export default app;