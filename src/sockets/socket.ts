import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, JWTPayload } from "../utils/jwt.js";

export interface AuthenticatedSocket extends Socket {
    user?: JWTPayload;
}

export function initializeSocket(httpServer: HTTPServer): Server {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
            methods: ["GET", "POST"],
        },
    });

    // Authentication middleware
    io.use((socket: AuthenticatedSocket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error("Unauthorized"));
        }

        const payload = verifyToken(token);
        if (!payload) {
            return next(new Error("Invalid token"));
        }

        socket.user = payload;
        next();
    });

    // Connection handler
    io.on("connection", (socket: AuthenticatedSocket) => {
        if (!socket.user) return;

        const { dealId } = socket.user;
        const userId = socket.user.userId;
        const identityId = socket.user.identityId;

        socket.join(`deal-${dealId}`);

        socket.on("message", async (data: { content: string; type?: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                io.to(`deal-${socket.user.dealId}`).emit("message:new", {
                    dealId: socket.user.dealId,
                    userId,
                    identityId,
                    content: data.content,
                    type: data.type || "TEXT",
                    timestamp: new Date().toISOString(),
                });

                callback?.({ success: true });
            } catch (error) {
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        socket.on("status:update", async (data: { status: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                io.to(`deal-${socket.user.dealId}`).emit("status:changed", {
                    dealId: socket.user.dealId,
                    status: data.status,
                    timestamp: new Date().toISOString(),
                });

                callback?.({ success: true });
            } catch (error) {
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        socket.on("disconnect", () => {
            socket.leave(`deal-${dealId}`);
        });
    });

    return io;
}
