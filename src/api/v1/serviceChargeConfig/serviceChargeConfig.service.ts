import prisma from "../../../config/prisma.js";
import type { CreateServiceChargeConfigPayload, UpdateServiceChargeConfigPayload } from "./serviceChargeConfig.types.js";

const createServiceChargeConfig = async (payload: CreateServiceChargeConfigPayload) => {
    return prisma.serviceChargeConfig.create({
        data: payload,
    });
};

const getServiceChargeConfigs = async () => {
    return prisma.serviceChargeConfig.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            method: true,
        },
    });
};

const getSingleServiceChargeConfig = async (id: number) => {
    return prisma.serviceChargeConfig.findUnique({
        where: { id },
        include: {
            method: true,
        },
    });
};

const updateServiceChargeConfig = async (id: number, payload: UpdateServiceChargeConfigPayload) => {
    return prisma.serviceChargeConfig.update({
        where: { id },
        data: payload,
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
