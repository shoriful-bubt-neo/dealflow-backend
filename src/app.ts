import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import roleRoutes from "./api/v1/role/role.route.js";
import userRoutes from "./api/v1/user/user.route.js";
import paymentMethodRoutes from "./api/v1/paymentMethod/paymentMethod.route.js";
import serviceChargeConfigRoutes from "./api/v1/serviceChargeConfig/serviceChargeConfig.route.js";
import dealRoutes from "./api/v1/deal/deal.route.js";
import authRoutes from "./api/v1/auth/auth.route.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import { authenticateToken } from "./middlewares/auth.js";
import prisma from "./config/prisma.js";

const app = express();
app.set("trust proxy", true);

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// Dispute evidence files (public read)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Auth middleware for all routes
app.use(authenticateToken);

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/payment-methods", paymentMethodRoutes);
app.use("/api/v1/service-charge-configs", serviceChargeConfigRoutes);
app.use("/api/v1/deals", dealRoutes);

// middlewares
app.use(globalErrorHandler);

// starting point
app.get("/", (req, res) => {
    res.send("DealFlow API running...");
});

export default app;