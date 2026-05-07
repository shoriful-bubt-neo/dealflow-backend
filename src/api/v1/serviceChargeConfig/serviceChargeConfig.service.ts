import prisma from "../../../config/prisma.js";
import type { CreateServiceChargeConfigPayload, UpdateServiceChargeConfigPayload } from "./serviceChargeConfig.types.js";

const createServiceChargeConfig = async (
    payload: CreateServiceChargeConfigPayload
) => {
    const data = {
        ...payload,
        percentage:
            payload.type === "PERCENTAGE"
                ? payload.percentage
                : null,

        fixedAmount:
            payload.type === "FIXED"
                ? payload.fixedAmount
                : null,
    };

    return prisma.serviceChargeConfig.create({
        data,
    });
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
    const data = {
        ...payload,
    };

    if (payload.type === "PERCENTAGE") {
        data.fixedAmount = null;
    }

    if (payload.type === "FIXED") {
        data.percentage = null;
    }

    return prisma.serviceChargeConfig.update({
        where: { id },
        data,
        include: {
            method: true,
        },
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
