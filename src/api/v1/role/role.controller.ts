import { Request, Response } from "express";
import { RoleService } from "./role.service.js";
import catchAsync from "../../../utils/catchAsync.js";
import sendResponse from "../../../utils/sendResponse.js";

export const createRole = catchAsync(async (req: Request, res: Response) => {
    const result = await RoleService.createRole(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Roles created successfully",
        data: result,
    });
});

export const getRoles = catchAsync(async (_req: Request, res: Response) => {
    const result = await RoleService.getRoles();

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Roles fetched successfully",
        data: result,
    });
});

export const getSingleRole = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await RoleService.getSingleRole(id);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Roles fetched successfully",
        data: result,
    });
});

export const updateRole = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await RoleService.updateRole(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Roles updated successfully",
        data: result,
    });
});

export const deleteRole = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await RoleService.deleteRole(id);

    res.status(200).json({
        success: true,
        message: "Role deleted successfully",
        data: result,
    });
});