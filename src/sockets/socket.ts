import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, JWTPayload } from "../utils/jwt.js";
import prisma from "../config/prisma.js";
import { sendMessage, submitPayment } from "../api/v1/deal/deal.room.service.js";
import cookieParser from "cookie-parser";

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

    io.use((socket: AuthenticatedSocket, next) => {
        const cookieHeader = socket.handshake.headers.cookie;

        if (!cookieHeader) {
            return next(new Error("Unauthorized: No cookies found"));
        }

        try {
            const cookies = cookieParser.JSONCookies(
                (cookieHeader as string).split(';').reduce((res, c) => {
                    const [key, val] = c.trim().split('=');
                    if (key && val) res[key] = decodeURIComponent(val);
                    return res;
                }, {} as Record<string, string>)
            );

            const token = cookies['authToken'];

            if (!token) {
                return next(new Error("Unauthorized: Token missing"));
            }

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

        const { dealId, identityId, userId } = socket.user;
        socket.join(`deal-${dealId}`);

        socket.on("message", async (data: { content: string; type?: string }, callback?: any) => {
            try {
                if (!socket.user) throw new Error("Unauthorized");

                // const newMessage = await prisma.message.create({
                //     data: {
                //         dealId: socket.user.dealId,
                //         senderType: socket.user.role === "BUYER" ? "BUYER" :
                //             socket.user.role === "SELLER" ? "SELLER" : "ADMIN",
                //         content: data.content,
                //         type: data.type || "TEXT",
                //         createdAt: new Date(),
                //         senderId: userId || null,
                //     },
                // });

                const newMessage = await sendMessage(
                    socket.user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    data.content,
                    data.type || "TEXT"
                );

                io.to(`deal-${socket.user.dealId}`).emit("message:new", {
                    id: newMessage.id,
                    dealId: newMessage.dealId,
                    senderType: newMessage.senderType,
                    content: newMessage.content,
                    type: newMessage.type,
                    createdAt: newMessage.createdAt.toISOString(),
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

                // const updatedDeal = await prisma.deal.update({
                //     where: { id: socket.user.dealId },
                //     data: { status: data.status },
                // });
                const updatedDeal = await updateDealStatus(
                    socket.user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    data.status
                );

                io.to(`deal-${socket.user.dealId}`).emit("status:changed", {
                    dealId: updatedDeal.id,
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
                    socket.user.dealId,
                    socket.user.userId || null,
                    socket.user.identityId,
                    data.trxId,
                    data.paymentMethod,
                    data.amount
                );
                io.to(`deal-${socket.user.dealId}`).emit("payment:confirmed", {
                    dealId: socket.user.dealId,
                    success: true,
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