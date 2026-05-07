import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";

export const globalErrorHandler = (err: any, _req: any, res: any, _next: any) => {
    let statusCode = 500;
    let message = "Something went wrong";
    let errors: any[] = [];

    // Prisma Error
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

    // Zod Error
    else if (err instanceof ZodError) {
        statusCode = 400;
        message = "Validation Error";

        errors = err.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
        }));
    }

    // Default Error
    else {
        statusCode = err.statusCode || 500;
        message = err.message || message;
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};