import { Router } from "express";
import { protectRoute } from "../../../middlewares/auth.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { handleKycSelfiePresign, handleVerifyKyc } from "./kyc.controller.js";
import { kycSelfiePresignSchema, verifyKycSchema } from "./kyc.validation.js";

const router = Router();

router.post(
  "/selfie/presign",
  protectRoute,
  validateRequest(kycSelfiePresignSchema),
  handleKycSelfiePresign,
);

router.post(
  "/verify",
  protectRoute,
  validateRequest(verifyKycSchema),
  handleVerifyKyc,
);

export default router;
