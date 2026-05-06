export type CreateServiceChargeConfigPayload = {
    paymentMethodId: number;
    type: "PERCENTAGE" | "FIXED";
    percentage?: number;
    fixedAmount?: number;
    payer: "BUYER" | "SELLER" | "SPLIT";
    isActive?: boolean;
};

export type UpdateServiceChargeConfigPayload = Partial<CreateServiceChargeConfigPayload>;
