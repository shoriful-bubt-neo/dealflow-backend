import prisma from "../../../config/prisma.js";
import type { CreatePaymentMethodPayload, UpdatePaymentMethodPayload } from "./paymentMethod.types.js";

const createPaymentMethod = async (payload: CreatePaymentMethodPayload) => {
    return prisma.paymentMethod.create({
        data: payload,
    });
};

const getPaymentMethods = async () => {
    return prisma.paymentMethod.findMany({
        orderBy: { createdAt: "desc" },
    });
};

const getSinglePaymentMethod = async (id: number) => {
    return prisma.paymentMethod.findUnique({
        where: { id },
    });
};

const updatePaymentMethod = async (id: number, payload: UpdatePaymentMethodPayload) => {
    return prisma.paymentMethod.update({
        where: { id },
        data: payload,
    });
};

const deletePaymentMethod = async (id: number) => {
    return prisma.paymentMethod.delete({
        where: { id },
    });
};

export const PaymentMethodService = {
    createPaymentMethod,
    getPaymentMethods,
    getSinglePaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
};
