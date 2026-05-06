import prisma from "../../../config/prisma.js";
import type { CreateUserPayload, UpdateUserPayload } from "./user.types.js";
import bcrypt from "bcrypt";

export const createUser = async (payload: CreateUserPayload & { roleIds?: string[] }) => {
    const { roleIds, password, ...userData } = payload;

    let hashedPassword;
    if (password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
    }

    return prisma.user.create({
        data: {
            ...userData,
            password: hashedPassword,
            roles: {
                create: roleIds?.map((id) => ({
                    roleId: Number(id),
                })),
            },
        },
    });
};

export const updateUser = async (id: number, payload: UpdateUserPayload & { roleIds?: string[] }) => {
    const { roleIds, password, ...userData } = payload;
    const data: any = { ...userData };

    if (password) {
        const salt = await bcrypt.genSalt(10);
        data.password = await bcrypt.hash(password, salt);
    }

    return prisma.user.update({
        where: { id },
        data: {
            ...data,
            roles: roleIds ? {
                deleteMany: {},
                create: roleIds.map((rid) => ({
                    roleId: Number(rid),
                })),
            } : undefined,
        },
    });
};

const getUsers = async (query: any) => {
    const {
        page = 1,
        limit = 2,
        search,
        type,
        status,
        isActive,
        isVerified,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    const searchCondition = search
        ? {
            OR: [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    phone: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ],
        }
        : {};

    const filterCondition: any = {};

    if (type) {
        filterCondition.type = type;
    }

    if (status) {
        filterCondition.status = status;
    }

    if (isActive !== undefined) {
        filterCondition.isActive = isActive === "true";
    }

    if (isVerified !== undefined) {
        filterCondition.isVerified = isVerified === "true";
    }

    const whereCondition = {
        AND: [
            searchCondition,
            filterCondition,
            {
                deletedAt: null,
            },
        ],
    };

    const data = await prisma.user.findMany({
        where: whereCondition,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },

        include: {
            roles: {
                include: {
                    role: true
                }
            },
        },
    });

    const total = await prisma.user.count({
        where: whereCondition,
    });

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPage: Math.ceil(total / Number(limit)),
        },
        data,
    };
};

const getSingleUser = async (id: number) => {
    return prisma.user.findUnique({
        where: { id },
    });
};

const deleteUser = async (id: number) => {
    return prisma.user.delete({
        where: { id },
    });
};

export const UserService = {
    createUser,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser,
};
