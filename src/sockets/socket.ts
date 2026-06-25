import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, JWTPayload } from "../utils/jwt.js";
import { sendMessage, submitPayment, updateDealStatus } from "../api/v1/deal/deal.room.service.js";
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

                // const updatedDeal = await prisma.deal.update({
                //     where: { id: socket.user.dealId },
                //     data: { status: data.status },
                // });
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

        socket.on("disconnect", () => {
            socket.leave(`deal-${user.dealId}`);
        });
    });

    return io;
}