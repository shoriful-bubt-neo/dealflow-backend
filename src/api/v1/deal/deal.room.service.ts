import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import prisma from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { MessageType, MessageSenderType, DealStatus } from "../../../generated/prisma/enums.js";
import { emitToDealRoom } from "../../../sockets/roomEmitter.js";

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
    // console.log("params: ", params);
    if (!SSL_COMMERZ_STORE_ID || !SSL_COMMERZ_STORE_PASSWORD) {
        throw new Error("SSLCommerz store credentials are not configured");
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            paymentMethodId: true,
            status: true,
            charge: { select: { buyerTotal: true } }
        },
    });
    if (!deal) {
        throw new Error("Deal not found");
    }

    const existingVerified = await prisma.payment.findFirst({
        where: {
            dealId,
            status: "VERIFIED",
        },
    });
    if (existingVerified) {
        return {
            success: true,
            message: "Payment already verified",
            transactionId: existingVerified.trxId,
        };
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

    const isSuccess = validated.status === "VALID" || validated.status === "VALIDATED";
    const transactionId = String(validated.tran_id || "");
    const paidAmount = Number(validated.amount || 0);

    const paymentStatus = isSuccess ? "VERIFIED" : "FAILED";
    const existingPayment = await prisma.payment.findFirst({
        where: { dealId, trxId: transactionId },
    });

    if (!existingPayment) {
        await prisma.payment.create({
            data: {
                dealId,
                trxId: transactionId || `FAILED-${Date.now()}`,
                paymentMethodId: deal.paymentMethodId ?? undefined,
                direction: "IN",
                idempotencyKey: uuidv4(),
                status: paymentStatus,
                ipAddress: ipAddress || undefined,
                deviceInfo: userAgent || undefined,
                gatewayResponse: validated,
            },
        });
    } else {
        await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
                status: paymentStatus,
                gatewayResponse: validated,
            },
        });
    }

    if (isSuccess) {
        const expectedAmount = Number(deal.charge?.buyerTotal || 0);
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
            console.warn(`Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
        }

        if (deal.status === "CREATED" || deal.status === "AWAITING_PAYMENT" || deal.status === "PAYMENT_PENDING") {
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
                    previousStatus: deal.status,
                    newStatus: "PAID",
                    validationStatus: validated.status,
                },
            },
        });

        const existingMsg = await prisma.message.findFirst({
            where: {
                dealId,
                content: { contains: `SSLCommerz payment successful for transaction ${transactionId}` }
            }
        });
        const paymentMessage = existingMsg ?? await prisma.message.create({
            data: {
                dealId,
                type: "SYSTEM",
                senderType: "ADMIN",
                content: `SSLCommerz payment successful for transaction ${transactionId}. Amount paid: ৳${paidAmount}.`,
                createdAt: new Date(),
            },
        });

        emitToDealRoom(dealId, "message:new", {
            id: paymentMessage.id,
            dealId,
            senderType: paymentMessage.senderType,
            senderRole: "admin",
            content: paymentMessage.content,
            type: paymentMessage.type,
            createdAt: paymentMessage.createdAt.toISOString(),
        });

        emitToDealRoom(dealId, "payment:confirmed", {
            dealId,
            success: true,
            transactionId,
            amount: paidAmount,
        });

        return {
            success: true,
            message: "Payment verified successfully",
            transactionId,
        };
    } else {
        await prisma.auditLog.create({
            data: {
                dealId,
                action: "SSL_COMMERZ_PAYMENT_FAILED",
                entityType: "deal",
                entityId: dealId,
                deviceId: userAgent || undefined,
                ipAddress: ipAddress || undefined,
                meta: {
                    transactionId,
                    paidAmount,
                    currentStatus: deal.status,
                    validationStatus: validated.status,
                    error: validated.error || "Payment failed",
                },
            },
        });

        const paymentMessage = await prisma.message.create({
            data: {
                dealId,
                type: "SYSTEM",
                senderType: "ADMIN",
                content: `SSLCommerz payment failed. Transaction: ${transactionId || "N/A"}. Reason: ${validated.error || "Unknown error"}.`,
                createdAt: new Date(),
            },
        });

        emitToDealRoom(dealId, "message:new", {
            id: paymentMessage.id,
            dealId,
            senderType: paymentMessage.senderType,
            senderRole: "admin",
            content: paymentMessage.content,
            type: paymentMessage.type,
            createdAt: paymentMessage.createdAt.toISOString(),
        });

        emitToDealRoom(dealId, "payment:failed", {
            dealId,
            success: false,
            message: "Payment failed. Please try again.",
            transactionId,
        });

        return {
            success: false,
            message: "Payment failed",
            transactionId,
        };
    }
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

export async function markItemDelivered(
    dealId: number,
    userId: number | null,
    identityId: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<{ success: boolean; message: string }> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            sellerId: true,
            sellerIdentityId: true,
            status: true,
            charge: { select: { buyerTotal: true } }
        }
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;
    if (!isSeller) {
        throw new Error("Unauthorized: Only seller can mark as delivered");
    }

    // Validate deal status
    if (deal.status !== "PAID" && deal.status !== "PAYMENT_RECEIVED") {
        throw new Error(`Invalid deal status: ${deal.status}. Deal must be PAID to mark as delivered.`);
    }

    // Update deal status to DELIVERED
    const updatedDeal = await prisma.deal.update({
        where: { id: dealId },
        data: { status: "DELIVERED" }
    });

    await prisma.auditLog.create({
        data: {
            dealId,
            userId: userId ?? undefined,
            action: "ITEM_MARKED_DELIVERED",
            entityType: "deal",
            entityId: dealId,
            deviceId: identityId,
            ipAddress: ipAddress || undefined,
            meta: {
                previousStatus: deal.status,
                newStatus: "DELIVERED",
                timestamp: new Date().toISOString()
            }
        }
    });

    // Create system message (for both buyer and seller to see)
    const buyerTotal = Number(deal.charge?.buyerTotal || 0);
    const message = await prisma.message.create({
        data: {
            dealId,
            type: "SYSTEM",
            senderType: "ADMIN",
            content: `Item has been marked as DELIVERED. Please confirm receipt within 24 hours.`,
            createdAt: new Date(),
        }
    });

    emitToDealRoom(dealId, "message:new", {
        id: message.id,
        dealId,
        senderType: message.senderType,
        senderRole: "seller",
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString()
    });

    emitToDealRoom(dealId, "status:changed", {
        dealId,
        status: "DELIVERED",
        timestamp: new Date().toISOString()
    });

    emitToDealRoom(dealId, "delivery:confirmed", {
        dealId,
        success: true,
        message: "Item marked as delivered. Awaiting buyer confirmation.",
        confirmDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    return {
        success: true,
        message: "Item marked as delivered successfully"
    };
}

export async function cancelOrder(
    dealId: number,
    userId: number | null,
    identityId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<{ success: boolean; message: string }> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            sellerId: true,
            sellerIdentityId: true,
            status: true,
            amount: true,
        }
    });

    if (!deal) {
        throw new Error("Deal not found");
    }

    const isSeller = deal.sellerId === userId || deal.sellerIdentityId === identityId;
    if (!isSeller) {
        throw new Error("Unauthorized: Only seller can cancel the order");
    }

    // Cannot cancel if already delivered or completed
    if (deal.status === "DELIVERED" || deal.status === "COMPLETED") {
        throw new Error("Cannot cancel: Item already delivered or deal completed");
    }

    const updatedDeal = await prisma.deal.update({
        where: { id: dealId },
        data: { status: "CANCELLED" }
    });

    await prisma.auditLog.create({
        data: {
            dealId,
            userId: userId ?? undefined,
            action: "ORDER_CANCELLED",
            entityType: "deal",
            entityId: dealId,
            deviceId: identityId,
            ipAddress: ipAddress || undefined,
            meta: {
                previousStatus: deal.status,
                newStatus: "CANCELLED",
                reason: reason || "Cancelled by seller",
                timestamp: new Date().toISOString()
            }
        }
    });

    // Create system message (shows deal is closed)
    const message = await prisma.message.create({
        data: {
            dealId,
            type: "SYSTEM",
            senderType: "ADMIN",
            content: `❌ Order has been CANCELLED by seller${reason ? `: ${reason}` : ''}. This deal is now closed.`,
            createdAt: new Date(),
        }
    });


    emitToDealRoom(dealId, "message:new", {
        id: message.id,
        dealId,
        senderType: message.senderType,
        senderRole: "admin",
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString()
    });

    // Send status:changed (updates progress bar to cancelled state)
    emitToDealRoom(dealId, "status:changed", {
        dealId,
        status: "CANCELLED",
        timestamp: new Date().toISOString()
    });


    emitToDealRoom(dealId, "deal:closed", {
        dealId,
        reason: "cancelled",
        message: "This deal has been cancelled by the seller.",
        timestamp: new Date().toISOString()
    });

    // If payment was made, trigger refund flow
    const payment = await prisma.payment.findFirst({
        where: {
            dealId,
            status: "VERIFIED"
        }
    });

    if (payment) {
        // Queue refund job or mark for refund
        console.log(`⚠️ Payment ${payment.trxId} needs refund for cancelled deal ${dealId}`);
        // You can trigger a refund API here or log for manual review
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "REFUND_INITIATED" }
        });
    }

    return {
        success: true,
        message: "Order cancelled successfully"
    };
}