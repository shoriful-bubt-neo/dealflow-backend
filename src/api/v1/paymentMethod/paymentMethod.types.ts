import type { Prisma } from "../../../generated/prisma/client.js";

export type CreatePaymentMethodPayload = {
    name: string;
    type: string;
    isActive?: boolean;
    config?: Prisma.InputJsonValue;
};

export type UpdatePaymentMethodPayload = Partial<CreatePaymentMethodPayload>;
