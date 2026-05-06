import { Request, Response } from "express";
import { PaymentMethodService } from "./paymentMethod.service.js";
import catchAsync from "../../../utils/catchAsync.js";
import sendResponse from "../../../utils/sendResponse.js";

export const createPaymentMethod = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentMethodService.createPaymentMethod(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Payment method created successfully",
        data: result,
    });
});

export const getPaymentMethods = catchAsync(async (_req: Request, res: Response) => {
    const result = await PaymentMethodService.getPaymentMethods();

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Payment methods fetched successfully",
        data: result,
    });
});

export const getSinglePaymentMethod = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await PaymentMethodService.getSinglePaymentMethod(id);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Payment method fetched successfully",
        data: result,
    });
});

export const updatePaymentMethod = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await PaymentMethodService.updatePaymentMethod(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Payment method updated successfully",
        data: result,
    });
});

export const deletePaymentMethod = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await PaymentMethodService.deletePaymentMethod(id);

    res.status(200).json({
        success: true,
        message: "Payment method deleted successfully",
        data: result,
    });
});
