import { Request, Response } from "express";
import { UserService } from "./user.service.js";
import catchAsync from "../../../utils/catchAsync.js";
import sendResponse from "../../../utils/sendResponse.js";

export const createUser = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createUser(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "User created successfully",
        data: result,
    });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getUsers(req.query);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Users fetched successfully",
        meta: result.meta,
        data: result.data,
    });
});

export const getSingleUser = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await UserService.getSingleUser(id);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await UserService.updateUser(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "User updated successfully",
        data: result,
    });
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const result = await UserService.deleteUser(id);

    res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: result,
    });
});
