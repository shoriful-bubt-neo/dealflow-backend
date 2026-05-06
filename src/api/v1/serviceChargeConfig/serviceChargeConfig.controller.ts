import { Request, Response } from "express";
import { ServiceChargeConfigService } from "./serviceChargeConfig.service.js";
import catchAsync from "../../../utils/catchAsync.js";
import sendResponse from "../../../utils/sendResponse.js";

export const createServiceChargeConfig = catchAsync(async (req: Request, res: Response) => {
    const result = await ServiceChargeConfigService.createServiceChargeConfig(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Service charge config created successfully",
        data: result,
    });
});

export const getServiceChargeConfigs = catchAsync(async (_req: Request, res: Response) => {
    const result = await ServiceChargeConfigService.getServiceChargeConfigs();

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Service charge configs fetched successfully",
        data: result,
    });
});

export const getSingleServiceChargeConfig = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await ServiceChargeConfigService.getSingleServiceChargeConfig(id);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Service charge config fetched successfully",
        data: result,
    });
});

export const updateServiceChargeConfig = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await ServiceChargeConfigService.updateServiceChargeConfig(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Service charge config updated successfully",
        data: result,
    });
});

export const deleteServiceChargeConfig = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await ServiceChargeConfigService.deleteServiceChargeConfig(id);

    res.status(200).json({
        success: true,
        message: "Service charge config deleted successfully",
        data: result,
    });
});
