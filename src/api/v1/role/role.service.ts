import prisma from "../../../config/prisma.js";

const createRole = async (payload: { name: string; isActive?: boolean }) => {
    return prisma.role.create({
        data: payload,
    });
};

const getRoles = async () => {
    return prisma.role.findMany({
        orderBy: { createdAt: "desc" },
    });
};

const getSingleRole = async (id: number) => {
    return prisma.role.findUnique({
        where: { id },
    });
};

const updateRole = async (
    id: number,
    payload: { name?: string; isActive?: boolean }
) => {
    return prisma.role.update({
        where: { id },
        data: payload,
    });
};

const deleteRole = async (id: number) => {
    return prisma.role.delete({
        where: { id },
    });
};

export const RoleService = {
    createRole,
    getRoles,
    getSingleRole,
    updateRole,
    deleteRole,
};