import prisma from "../../../config/prisma.js";
import type { CreateServiceChargeConfigPayload, UpdateServiceChargeConfigPayload } from "./serviceChargeConfig.types.js";

const createServiceChargeConfig = async (
    payload: CreateServiceChargeConfigPayload
) => {
    const data: any = {
        paymentMethodId: payload.paymentMethodId,
        minAmount: Number(payload.minAmount) || 0,
        maxAmount: payload.maxAmount !== undefined && payload.maxAmount !== null ? Number(payload.maxAmount) : null,
        type: payload.type,
        payer: payload.payer,
        isActive: payload.isActive ?? true,
    };

    if (payload.type === "PERCENTAGE") {
        data.percentage = payload.percentage !== undefined && payload.percentage !== null ? Number(payload.percentage) : null;
        data.fixedAmount = null;
    }

    if (payload.type === "FIXED") {
        data.fixedAmount = payload.fixedAmount !== undefined && payload.fixedAmount !== null ? Number(payload.fixedAmount) : null;
        data.percentage = null;
    }

    return prisma.serviceChargeConfig.create({ data });
};

const getServiceChargeConfigs = async () => {
    return prisma.serviceChargeConfig.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            method: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
    });
};

const getSingleServiceChargeConfig = async (id: number) => {
    return prisma.serviceChargeConfig.findUnique({
        where: { id },
        include: {
            method: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
    });
};

const updateServiceChargeConfig = async (
    id: number,
    payload: UpdateServiceChargeConfigPayload
) => {
    const data: any = {};

    if (payload.paymentMethodId !== undefined) data.paymentMethodId = payload.paymentMethodId;
    if (payload.minAmount !== undefined) data.minAmount = Number(payload.minAmount);
    if (payload.maxAmount !== undefined) data.maxAmount = payload.maxAmount !== null ? Number(payload.maxAmount) : null;
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.payer !== undefined) data.payer = payload.payer;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;

    if (payload.type === "PERCENTAGE") {
        data.percentage = payload.percentage !== undefined && payload.percentage !== null ? Number(payload.percentage) : null;
        data.fixedAmount = null;
    }

    if (payload.type === "FIXED") {
        data.fixedAmount = payload.fixedAmount !== undefined && payload.fixedAmount !== null ? Number(payload.fixedAmount) : null;
        data.percentage = null;
    }

    return prisma.serviceChargeConfig.update({
        where: { id },
        data,
        include: { method: true },
    });
};

const deleteServiceChargeConfig = async (id: number) => {
    return prisma.serviceChargeConfig.delete({
        where: { id },
    });
};

export const ServiceChargeConfigService = {
    createServiceChargeConfig,
    getServiceChargeConfigs,
    getSingleServiceChargeConfig,
    updateServiceChargeConfig,
    deleteServiceChargeConfig,
};
