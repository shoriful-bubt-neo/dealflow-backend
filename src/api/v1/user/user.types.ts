export type CreateUserPayload = {
    name?: string;
    phone: string;
    password?: string;
    isVerified?: boolean;
    type?: "ADMIN" | "BUYER" | "SELLER";
    status?:
        | "PENDING_VERIFICATION"
        | "VERIFIED"
        | "SUSPENDED"
        | "CLOSED";
    isActive?: boolean;
    // JODI MULTIPLE ROLE THAKE (MODAL THEKE ASHE)
    roleIds?: string[]; 
};

export type UpdateUserPayload = Partial<CreateUserPayload>;