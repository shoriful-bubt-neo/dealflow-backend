import { Router } from "express";
import { protectRoute } from "../../../middlewares/auth.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import {
  createUploadPresignSchema,
  getDownloadPresignSchema,
} from "./upload.validation.js";
import {
  createUploadPresignedUrl,
  getDownloadPresignedUrl,
} from "./upload.controller.js";

const router = Router();

router.post(
  "/presigned-url",
  protectRoute,
  validateRequest(createUploadPresignSchema),
  createUploadPresignedUrl,
);

router.get(
  "/presigned-url",
  protectRoute,
  validateRequest(getDownloadPresignSchema),
  getDownloadPresignedUrl,
);

export default router;
