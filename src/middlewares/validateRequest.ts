import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

const validateRequest = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            schema.parse({
                body: req.body,
                params: req.params,
                query: req.query,
            });

            next();
        } catch (err) {
            next(err);
        }
    };
};

export default validateRequest;