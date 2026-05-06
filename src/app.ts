import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import roleRoutes from "./api/v1/role/role.route.js";
import userRoutes from "./api/v1/user/user.route.js";
import paymentMethodRoutes from "./api/v1/paymentMethod/paymentMethod.route.js";
import serviceChargeConfigRoutes from "./api/v1/serviceChargeConfig/serviceChargeConfig.route.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import prisma from "./config/prisma.js";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// routes
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/payment-methods", paymentMethodRoutes);
app.use("/api/v1/service-charge-configs", serviceChargeConfigRoutes);

// middlewares
app.use(globalErrorHandler);

// starting point
app.get("/", (req, res) => {
    res.send("DealFlow API running...");
});

export default app;