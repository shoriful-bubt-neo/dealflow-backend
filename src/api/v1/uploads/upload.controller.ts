import { Request, Response } from "express";
import catchAsync from "../../../utils/catchAsync.js";
import sendResponse from "../../../utils/sendResponse.js";
import * as UploadService from "./upload.service.js";
import {
  createUploadPresignSchema,
  getDownloadPresignSchema,
} from "./upload.validation.js";

function sessionRole(req: Request): "BUYER" | "SELLER" | undefined {
  return req.user?.role === "BUYER" || req.user?.role === "SELLER"
    ? req.user.role
    : undefined;
}

function actor(req: Request) {
  const userId = (req.user?.id ?? req.user?.userId) || null;
  const identityId = req.user?.identityId;
  return { userId: userId && userId > 0 ? userId : null, identityId };
}

export const createUploadPresignedUrl = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = createUploadPresignSchema.parse({ body: req.body });
    const { userId, identityId } = actor(req);

    if (!identityId && !userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.user?.dealId && req.user.dealId !== body.dealId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Token is for a different deal",
      });
    }

    const data = await UploadService.createUploadPresignedUrl(
      body,
      userId,
      identityId,
      sessionRole(req),
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Upload URL generated",
      data,
    });
  },
);

export const getDownloadPresignedUrl = catchAsync(
  async (req: Request, res: Response) => {
    const { query } = getDownloadPresignSchema.parse({ query: req.query });
    const { userId, identityId } = actor(req);

    if (!identityId && !userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.user?.dealId && query.dealId && req.user.dealId !== query.dealId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Token is for a different deal",
      });
    }

    const data = await UploadService.createDownloadPresignedUrl(
      query,
      userId,
      identityId,
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Download URL generated",
      data,
    });
  },
);
