import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

const validateRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse({
                body: req.body,
                params: req.params,
                query: req.query,
            });

            next();
        } catch (err: any) {
            res.status(400).json({
                success: false,
                message: "Validation Error",
                errors: err.errors,
            });
        }
    };
};

export default validateRequest;