export type CreateServiceChargeConfigPayload = {
    paymentMethodId: number;
    minAmount: number;
    maxAmount?: number | null;
    type: "PERCENTAGE" | "FIXED";
    percentage?: number;
    fixedAmount?: number;
    payer: "BUYER" | "SELLER" | "SPLIT";
    isActive?: boolean;
};

export type UpdateServiceChargeConfigPayload = Partial<CreateServiceChargeConfigPayload>;
