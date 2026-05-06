import express from "express";
import * as PaymentMethodController from "./paymentMethod.controller.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { createPaymentMethodSchema, updatePaymentMethodSchema } from "./paymentMethod.validation.js";

const router = express.Router();

router.post("/", validateRequest(createPaymentMethodSchema), PaymentMethodController.createPaymentMethod);

router.get("/", PaymentMethodController.getPaymentMethods);

router.get("/:id", PaymentMethodController.getSinglePaymentMethod);

router.patch("/:id", validateRequest(updatePaymentMethodSchema), PaymentMethodController.updatePaymentMethod);

router.delete("/:id", PaymentMethodController.deletePaymentMethod);

export default router;
