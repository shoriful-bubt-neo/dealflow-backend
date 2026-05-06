export type CreatePaymentMethodPayload = {
    name: string;
    type: string;
    isActive?: boolean;
    config?: unknown;
};

export type UpdatePaymentMethodPayload = Partial<CreatePaymentMethodPayload>;
