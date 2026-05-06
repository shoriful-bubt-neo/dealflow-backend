import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import roleRoutes from "./api/v1/role/role.route.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import prisma from "./config/prisma.js";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/v1/roles", roleRoutes);

app.use(globalErrorHandler);

app.get("/", (req, res) => {
    res.send("DealFlow API running...");
});

app.get("/users", async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (error) {
        res.status(500).json({
            error: "Something went wrong!"
        })
    }
})

export default app;