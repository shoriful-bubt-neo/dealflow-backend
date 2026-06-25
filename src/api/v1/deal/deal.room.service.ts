import { v4 as uuidv4 } from "uuid";
import prisma from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { MessageType, MessageSenderType, DealStatus } from "../../../generated/prisma/enums.js";

export interface DealRoomData {
    id: number;
    item: string;
    amount: number;
    status: string;
    paymentRef: string;
    inviteExpiresAt: string | null;
    buyerPhone: string | null;
    sellerPhone: string | null;
    // viewerRole: "BUYER" | "SELLER";
    charge: {
        baseAmount: number;
        chargeType: "FIXED" | "PERCENTAGE";
        chargeValue: number;
        totalCharge: number;
        buyerPays: number;
        sellerPays: number;
        buyerTotal: number;
        sellerReceives: number;
    } | null;
}

export interface MessageData {
    id: number;
    dealId?: number;
    content: string;
    type: MessageType;
    senderType: MessageSenderType;
    senderRole?: "buyer" | "seller" | "admin";
    createdAt: string;
}

export async function getDealRoom(
    dealId: number,
    userId: number | null,
    identityId: string,
): Promise<DealRoomData> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
            charge: true,
            buyer: { select: { id: true } },
            seller: { select: { id: true } },
            paymentMethod: {
                select: {
                    id: true,
                    name: true,
                    config: true,
                }
            }
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    // const isBuyer = deal.buyerId === userId || deal.buyerIdentityId === identityId;
    // const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;

    // if (!isBuyer && !isSeller) {
    //     throw new Error("Unauthorized: Not a participant in this deal");
    // }

    return {
        id: deal.id,
        item: deal.item || "",
        amount: Number(deal.amount.toString()),
        status: deal.status,
        paymentRef: deal.paymentRef,
        inviteExpiresAt: deal.inviteExpiresAt?.toISOString() ?? null,
        buyerPhone: deal.buyerPhone,
        sellerPhone: deal.sellerPhone,
        // viewerRole: isBuyer ? "BUYER" : "SELLER",
        charge: deal.charge
            ? {
                baseAmount: Number(deal.charge.baseAmount.toString()),
                chargeType: deal.charge.chargeType,
                chargeValue: Number(deal.charge.chargeValue.toString()),
                totalCharge: Number(deal.charge.totalCharge.toString()),
                buyerPays: Number(deal.charge.buyerPays.toString()),
                sellerPays: Number(deal.charge.sellerPays.toString()),
                buyerTotal: Number(deal.charge.buyerTotal.toString()),
                sellerReceives: Number(deal.charge.sellerReceives.toString()),
            }
            : null,
        paymentMethod: deal.paymentMethod ? {
            id: deal.paymentMethod.id,
            name: deal.paymentMethod.name,
            config: deal.paymentMethod.config as any,
        } : null,
    };
}

export async function getDealMessages(
    dealId: number,
    userId: number | null,
    identityId: string,
): Promise<MessageData[]> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            buyerId: true,
            sellerId: true,
            buyerIdentityId: true,
            sellerIdentityId: true,
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isBuyer = deal.buyerId === userId || deal.buyerIdentityId === identityId;
    const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;

    if (!isBuyer && !isSeller) {
        throw new Error("Unauthorized: Not a participant in this deal");
    }

    const messages = await prisma.message.findMany({
        where: { dealId },
        select: {
            id: true,
            content: true,
            type: true,
            senderType: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    return messages.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        senderType: m.senderType,
        createdAt: m.createdAt.toISOString(),
    }));
}

export async function sendMessage(
    dealId: number,
    userId: number | null,
    identityId: string,
    content: string,
    type: MessageType = "USER",
): Promise<MessageData> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            buyerId: true,
            sellerId: true,
            buyerIdentityId: true,
            sellerIdentityId: true,
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isBuyer = deal.buyerId === userId || deal.buyerIdentityId === identityId;
    const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;

    if (!isBuyer && !isSeller) {
        throw new Error("Unauthorized: Not a participant in this deal");
    }

    const senderType: MessageSenderType = isBuyer || isSeller ? "USER" : "SYSTEM";
    const senderRole = isBuyer ? "buyer" : isSeller ? "seller" : "admin";

    const message = await prisma.message.create({
        data: {
            dealId,
            senderId: userId ?? undefined,
            content,
            type,
            senderType,
        },
        select: {
            id: true,
            dealId: true,
            content: true,
            type: true,
            senderType: true,
            createdAt: true,
        },
    });

    return {
        id: message.id,
        dealId: message.dealId,
        content: message.content,
        type: message.type,
        senderType: message.senderType,
        senderRole,
        createdAt: message.createdAt.toISOString(),
    };
}

export async function updateDealStatus(
    dealId: number,
    userId: number | null,
    identityId: string,
    newStatus: DealStatus | string,
): Promise<{ status: string }> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            status: true,
            buyerId: true,
            sellerId: true,
            buyerIdentityId: true,
            sellerIdentityId: true,
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isBuyer = deal.buyerId === userId || deal.buyerIdentityId === identityId;
    const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;

    if (!isBuyer && !isSeller) {
        throw new Error("Unauthorized: Not a participant in this deal");
    }

    const normalizedStatus = typeof newStatus === "string" && newStatus === "PAYMENT_PENDING"
        ? "AWAITING_PAYMENT"
        : newStatus;
    const validStatuses = [
        "CREATED",
        "AWAITING_PAYMENT",
        "PAYMENT_RECEIVED",
        "ITEM_DELIVERED",
        "PAYMENT_RELEASED",
        "CANCELLED",
        "ON_HOLD",
    ];
    if (!validStatuses.includes(normalizedStatus)) {
        throw new Error("Invalid status");
    }

    const updatedDeal = await prisma.deal.update({
        where: { id: dealId },
        data: {
            status: normalizedStatus as DealStatus,
        },
        select: { status: true },
    });

    await prisma.auditLog.create({
        data: {
            dealId,
            userId: userId ?? undefined,
            action: "DEAL_STATUS_UPDATED",
            entityType: "deal",
            entityId: dealId,
            deviceId: identityId,
            meta: {
                previousStatus: deal.status,
                newStatus,
            },
        },
    });

    return { status: updatedDeal.status };
}

export async function submitPayment(
    dealId: number,
    userId: number | null,
    identityId: string,
    trxId: string,
    paymentMethodId: number,
    amount: number,
): Promise<{ success: boolean }> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            buyerId: true,
            buyerIdentityId: true,
            status: true,
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isBuyer = deal.buyerId === userId || deal.buyerIdentityId === identityId;
    if (!isBuyer) {
        throw new Error("Unauthorized: Only buyer can submit payment");
    }

    const normalizedStatus: string = deal.status;
    if (normalizedStatus !== "CREATED" && normalizedStatus !== "AWAITING_PAYMENT") {
        throw new Error("Invalid deal status for payment submission");
    }

    const payment = await prisma.payment.create({
        data: {
            dealId,
            trxId,
            paymentMethodId,
            direction: "IN",
            idempotencyKey: uuidv4(),
            status: "VERIFIED",
        },
    });

    await prisma.auditLog.create({
        data: {
            dealId,
            userId: userId ?? undefined,
            action: "PAYMENT_SUBMITTED",
            entityType: "deal",
            entityId: dealId,
            deviceId: identityId,
            meta: {
                trxId,
                paymentMethodId,
                amount,
                paymentId: payment.id,
            },
        },
    });

    return { success: true };
}
