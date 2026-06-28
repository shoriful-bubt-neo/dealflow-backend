import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import prisma from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { MessageType, MessageSenderType, DealStatus } from "../../../generated/prisma/enums.js";

const SSL_COMMERZ_BASE_URL =
    process.env.SSL_COMMERZ_BASE_URL?.replace(/\/$/, "") ||
    "https://sandbox.sslcommerz.com";
const SSL_COMMERZ_STORE_ID = process.env.SSL_COMMERZ_STORE_ID;
const SSL_COMMERZ_STORE_PASSWORD = process.env.SSL_COMMERZ_STORE_PASSWORD;
const APP_URL =
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

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
    paymentMethod: {
        id: number;
        name: string;
        type: string;
        config: any;
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
                    type: true,
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
            type: deal.paymentMethod.type,
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
        "PAID",
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

function getSslCommerzGatewayUrl(path: string) {
    return `${SSL_COMMERZ_BASE_URL}${path}`;
}

export async function initiateSslCommerzPayment(
    dealId: number,
    userId: number | null,
    identityId: string,
    amount: number,
    ipAddress?: string,
    userAgent?: string,
): Promise<{ gatewayUrl: string; transactionId: string }> {
    if (!SSL_COMMERZ_STORE_ID || !SSL_COMMERZ_STORE_PASSWORD) {
        throw new Error("SSLCommerz store credentials are not configured");
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
            charge: true,
            paymentMethod: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    config: true,
                },
            },
        },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    if (!deal.charge) {
        throw new Error("Deal charge information is missing");
    }

    if (deal.status !== "CREATED" && deal.status !== "AWAITING_PAYMENT") {
        throw new Error("SSLCommerz payment can only be initiated for pending deals");
    }

    const buyerTotal = Number(deal.charge.buyerTotal.toString());
    if (Number(amount.toFixed(2)) !== Number(buyerTotal.toFixed(2))) {
        throw new Error("Payment amount must match the deal buyer total");
    }

    const transactionId = `ssl-${dealId}-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const successUrl = `${APP_URL}/api/v1/deals/${dealId}/payment/sslcommerz/callback?dealId=${dealId}`;
    const failUrl = `${APP_URL}/api/v1/deals/${dealId}/payment/sslcommerz/callback?dealId=${dealId}`;
    const cancelUrl = `${APP_URL}/api/v1/deals/${dealId}/payment/sslcommerz/callback?dealId=${dealId}`;
    const ipnUrl = `${APP_URL}/api/v1/deals/${dealId}/payment/sslcommerz/callback?dealId=${dealId}`;

    const formPayload = {
        store_id: SSL_COMMERZ_STORE_ID,
        store_passwd: SSL_COMMERZ_STORE_PASSWORD,
        total_amount: buyerTotal,
        currency: "BDT",
        tran_id: transactionId,
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: cancelUrl,
        ipn_url: ipnUrl,
        shipping_method: "NO",
        product_name: deal.item || "Deal Payment",
        product_category: deal.paymentMethod?.name || "Deal",
        product_profile: "general",
        cus_name: deal.paymentMethod?.name || "Customer",
        cus_email: "customer@example.com",
        cus_add1: deal.buyerPhone || "",
        cus_city: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: deal.buyerPhone || "",
        value_a: deal.paymentRef,
        value_b: userId ?? "",
        value_c: identityId,
        value_d: userAgent || "",
    };

    const response = await axios.post(
        getSslCommerzGatewayUrl("/gwprocess/v4/api.php"),
        new URLSearchParams(formPayload as Record<string, string | number>),
    );

    if (!response?.data?.GatewayPageURL) {
        throw new Error("SSLCommerz gateway did not return a payment URL");
    }

    const paymentMethodId = deal.paymentMethodId ?? deal.paymentMethod?.id;
    if (!paymentMethodId) {
        throw new Error("Deal payment method is not configured for SSLCommerz");
    }

    await prisma.payment.create({
        data: {
            dealId,
            trxId: transactionId,
            paymentMethodId,
            direction: "IN",
            idempotencyKey: uuidv4(),
            status: "PENDING",
            ipAddress: ipAddress || undefined,
            deviceInfo: userAgent || undefined,
            gatewayResponse: response.data,
        },
    });

    return {
        gatewayUrl: response.data.GatewayPageURL,
        transactionId,
    };
}

export async function confirmSslCommerzPayment(
    dealId: number,
    params: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
): Promise<{ success: boolean; message: string; transactionId?: string }> {
    console.log("params: ", params);
    if (!SSL_COMMERZ_STORE_ID || !SSL_COMMERZ_STORE_PASSWORD) {
        throw new Error("SSLCommerz store credentials are not configured");
    }

    const valId = String(params.val_id || params.valId || params.value_a || "").trim();
    if (!valId) {
        throw new Error("Missing validation ID from SSLCommerz callback");
    }

    const validationResponse = await axios.get(getSslCommerzGatewayUrl("/validator/api/validationserverAPI.php"), {
        params: {
            val_id: valId,
            store_id: SSL_COMMERZ_STORE_ID,
            store_passwd: SSL_COMMERZ_STORE_PASSWORD,
            v: 1,
            format: "json",
        },
    });

    const validated = validationResponse.data;
    if (!validated || !validated.status) {
        throw new Error("Invalid SSLCommerz validation response");
    }

    if (validated.status !== "VALID" && validated.status !== "VALIDATED") {
        throw new Error(`SSLCommerz transaction validation failed: ${validated.status}`);
    }

    const transactionId = String(validated.tran_id || "");
    const paidAmount = Number(validated.amount || 0);
    const sslPayment = await prisma.payment.findFirst({
        where: { dealId, trxId: transactionId },
    });

    if (!sslPayment) {
        await prisma.payment.create({
            data: {
                dealId,
                trxId: transactionId,
                paymentMethodId: deal.paymentMethodId ?? 1,
                direction: "IN",
                idempotencyKey: uuidv4(),
                status: "VERIFIED",
                ipAddress: ipAddress || undefined,
                deviceInfo: userAgent || undefined,
                gatewayResponse: validated,
            },
        });
    } else {
        await prisma.payment.update({
            where: { id: sslPayment.id },
            data: {
                status: "VERIFIED",
                gatewayResponse: validated,
            },
        });
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { status: true },
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    if (deal.status === "CREATED" || deal.status === "AWAITING_PAYMENT") {
        await prisma.deal.update({
            where: { id: dealId },
            data: { status: "PAID" },
        });
    }

    await prisma.auditLog.create({
        data: {
            dealId,
            action: "SSL_COMMERZ_PAYMENT_CONFIRMED",
            entityType: "deal",
            entityId: dealId,
            deviceId: userAgent || undefined,
            ipAddress: ipAddress || undefined,
            meta: {
                transactionId,
                paidAmount,
                currentStatus: deal.status,
                validationStatus: validated.status,
            },
        },
    });

    await prisma.message.create({
        data: {
            dealId,
            type: "SYSTEM",
            senderType: "ADMIN",
            content: `SSLCommerz payment successful for transaction ${transactionId}. Amount paid: ৳${paidAmount}.`,
            createdAt: new Date(),
        },
    });

    return {
        success: true,
        message: "Payment verified successfully",
        transactionId,
    };
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
