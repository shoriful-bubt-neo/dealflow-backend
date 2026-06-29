import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, JWTPayload } from "../utils/jwt.js";
import {
    sendMessage,
    submitPayment,
    updateDealStatus,
    markItemDelivered,
    cancelOrder,
} from "../api/v1/deal/deal.room.service.js";
import { setSocketServer } from "./roomEmitter.js";
import { parse as parseCookie } from "cookie";

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
    setSocketServer(io);

    io.use((socket: AuthenticatedSocket, next) => {
        const cookieHeader = socket.handshake.headers.cookie;
        const authTokenFromCookie = cookieHeader ? parseCookie(cookieHeader as string).authToken : undefined;
        const authTokenFromAuth = socket.handshake.auth?.token as string | undefined;
        const authTokenFromQuery = socket.handshake.query?.token as string | undefined;

        const token = authTokenFromCookie || authTokenFromAuth || authTokenFromQuery;

        if (!token) {
            return next(new Error("Unauthorized: Token missing"));
        }

        try {
            const payload = verifyToken(token);
            if (!payload) {
                return next(new Error("Invalid token"));
            }

            socket.user = payload;
            next();
        } catch (err) {
            return next(new Error("Internal authentication error"));
        }
    });

    io.on("connection", (socket: AuthenticatedSocket) => {
        if (!socket.user) return;

        const user = socket.user;
        socket.join(`deal-${user.dealId}`);

        // ----- Existing event handlers -----
        socket.on("message", async (data: { content: string; type?: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                const newMessage = await sendMessage(
                    socket.user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    data.content,
                    "USER"
                );

                io.to(`deal-${user.dealId}`).emit("message:new", {
                    id: newMessage.id,
                    dealId: newMessage.dealId,
                    senderType: newMessage.senderType,
                    senderRole:
                        user.role === "BUYER"
                            ? "buyer"
                            : user.role === "SELLER"
                            ? "seller"
                            : "admin",
                    content: newMessage.content,
                    type: newMessage.type,
                    createdAt: newMessage.createdAt,
                });

                callback?.({ success: true, message: newMessage });
            } catch (error) {
                console.error("Socket message error:", error);
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        socket.on("status:update", async (data: { status: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                const updatedDeal = await updateDealStatus(
                    user.dealId,
                    user.userId || null,
                    user.identityId,
                    data.status
                );

                io.to(`deal-${user.dealId}`).emit("status:changed", {
                    dealId: user.dealId,
                    status: updatedDeal.status,
                    timestamp: new Date().toISOString(),
                });

                callback?.({ success: true });
            } catch (error) {
                console.error("Status update error:", error);
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        socket.on("payment:submit", async (data: { trxId: string; paymentMethod: string; amount: number }, callback) => {
            try {
                const result = await submitPayment(
                    user.dealId,
                    user.userId || null,
                    user.identityId,
                    data.trxId,
                    Number(data.paymentMethod),
                    data.amount
                );
                io.to(`deal-${user.dealId}`).emit("payment:confirmed", {
                    dealId: user.dealId,
                    success: true,
                });
                callback?.({ success: true });
            } catch (error) {
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        // delivery:confirm event handler (Seller marks as delivered)
        socket.on("delivery:confirm", async (data: { dealId: number }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                // Call the service function directly
                const result = await markItemDelivered(
                    data.dealId || user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    socket.handshake.address, // IP address
                    socket.handshake.headers["user-agent"] as string | undefined,
                );

                callback?.({ success: true, data: result });
            } catch (error) {
                console.error("Socket delivery:confirm error:", error);
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        // order:cancel event handler (Seller cancels order)
        socket.on("order:cancel", async (data: { dealId: number; reason?: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                const result = await cancelOrder(
                    data.dealId || user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    data.reason,
                    socket.handshake.address,
                    socket.handshake.headers["user-agent"] as string | undefined,
                );

                callback?.({ success: true, data: result });
            } catch (error) {
                console.error("Socket order:cancel error:", error);
                callback?.({ success: false, error: (error as Error).message });
            }
        });

        socket.on("disconnect", () => {
            socket.leave(`deal-${user.dealId}`);
        });
    });

    return io;
}