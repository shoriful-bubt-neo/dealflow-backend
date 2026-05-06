import { Prisma } from "../generated/prisma/client.js";


export const globalErrorHandler = (err: any, _req: any, res: any, _next: any) => {
    let statusCode = 500;
    let message = "Something went wrong";
    let errors: any[] = [];

    // 🔴 Prisma Unique Constraint (P2002)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            statusCode = 409;
            message = "Duplicate field value";

            errors = [
                {
                    field: err.meta?.target,
                    message: "Already exists",
                },
            ];
        }
    }

    // 🔴 Zod Error
    else if (err.name === "ZodError") {
        statusCode = 400;
        message = "Validation Error";

        errors = err.errors.map((e: any) => ({
            field: e.path.join("."),
            message: e.message,
        }));
    }

    // 🔴 Default
    else {
        message = err.message || message;
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};