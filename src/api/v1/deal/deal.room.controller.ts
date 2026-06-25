import { Request, Response } from "express";
import * as dealRoomService from "./deal.room.service.js";
import { emitToDealRoom } from "../../../sockets/roomEmitter.js";
import { z } from "zod";

const sendMessageSchema = z.object({
    content: z.string().trim().min(1, "Message cannot be empty").max(2000),
    type: z.enum(["TEXT", "ATTACHMENT"]).optional().default("TEXT"),
});

const updateStatusSchema = z.object({
    status: z.enum(["CREATED", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ITEM_DELIVERED", "PAYMENT_RELEASED", "CANCELLED", "ON_HOLD"]),
});

const submitPaymentSchema = z.object({
    trxId: z.string().trim().min(1, "Transaction ID required"),
    paymentMethod: z.coerce.number().positive("Payment method ID is required"),
    amount: z.number().positive("Amount must be positive"),
});

export async function handleGetDealRoom(
    req: Request,
    res: Response,
): Promise<void | Response> {
    try {
        const dealId = Number(req.params.dealId);
        if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
            res.status(400).json({ success: false, message: "Invalid deal ID" });
            return;
        }

        const userId = req.user?.userId;
        const identityId = req.user?.identityId;

        if (!identityId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const deal = await dealRoomService.getDealRoom(dealId, userId || null, identityId);
        res.status(200).json({ success: true, data: deal });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message.includes("Unauthorized")) {
                return res.status(403).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function handleGetDealMessages(
    req: Request,
    res: Response,
): Promise<void | Response> {
    try {
        const dealId = Number(req.params.dealId);
        if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
            res.status(400).json({ success: false, message: "Invalid deal ID" });
            return;
        }

        const userId = req.user?.userId;
        const identityId = req.user?.identityId;

        if (!identityId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const messages = await dealRoomService.getDealMessages(dealId, userId || null, identityId);
        res.status(200).json({ success: true, data: messages });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message.includes("Unauthorized")) {
                return res.status(403).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function handleSendMessage(
    req: Request,
    res: Response,
): Promise<void | Response> {
    try {
        const dealId = Number(req.params.dealId);
        if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
            res.status(400).json({ success: false, message: "Invalid deal ID" });
            return;
        }

        const payload = sendMessageSchema.parse(req.body);
        const userId = req.user?.userId;
        const identityId = req.user?.identityId;

        if (!identityId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const message = await dealRoomService.sendMessage(
            dealId,
            userId || null,
            identityId,
            payload.content,
            payload.type,
        );

        emitToDealRoom(dealId, "message:new", {
            id: message.id,
            dealId,
            senderType: message.senderType,
            senderRole:
                req.user?.role === "BUYER"
                    ? "buyer"
                    : req.user?.role === "SELLER"
                        ? "seller"
                        : "admin",
            content: message.content,
            type: message.type,
            createdAt: message.createdAt,
        });

        res.status(201).json({ success: true, data: message });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === "ZodError") {
            const zodError = error as any;
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: zodError.errors,
            });
        }

        if (error instanceof Error) {
            if (error.message.includes("Unauthorized")) {
                return res.status(403).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function handleUpdateDealStatus(
    req: Request,
    res: Response,
): Promise<void | Response> {
    try {
        const dealId = Number(req.params.dealId);
        if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
            res.status(400).json({ success: false, message: "Invalid deal ID" });
            return;
        }

        const payload = updateStatusSchema.parse(req.body);
        const userId = req.user?.userId;
        const identityId = req.user?.identityId;

        if (!identityId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const result = await dealRoomService.updateDealStatus(
            dealId,
            userId || null,
            identityId,
            payload.status,
        );

        res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === "ZodError") {
            const zodError = error as any;
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: zodError.errors,
            });
        }

        if (error instanceof Error) {
            if (error.message.includes("Unauthorized")) {
                return res.status(403).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function handleSubmitPayment(
    req: Request,
    res: Response,
): Promise<void | Response> {
    try {
        const dealId = Number(req.params.dealId);
        if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
            res.status(400).json({ success: false, message: "Invalid deal ID" });
            return;
        }

        const payload = submitPaymentSchema.parse(req.body);
        const userId = req.user?.userId;
        const identityId = req.user?.identityId;

        if (!identityId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const result = await dealRoomService.submitPayment(
            dealId,
            userId || null,
            identityId,
            payload.trxId,
            payload.paymentMethod,
            payload.amount,
        );

        res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === "ZodError") {
            const zodError = error as any;
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: zodError.errors,
            });
        }

        if (error instanceof Error) {
            if (error.message.includes("Unauthorized")) {
                return res.status(403).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
