import express from "express";
import * as ServiceChargeConfigController from "./serviceChargeConfig.controller.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { createServiceChargeConfigSchema, updateServiceChargeConfigSchema } from "./serviceChargeConfig.validation.js";

const router = express.Router();

router.post("/", validateRequest(createServiceChargeConfigSchema), ServiceChargeConfigController.createServiceChargeConfig);

router.get("/", ServiceChargeConfigController.getServiceChargeConfigs);

router.get("/:id", ServiceChargeConfigController.getSingleServiceChargeConfig);

router.patch("/:id", validateRequest(updateServiceChargeConfigSchema), ServiceChargeConfigController.updateServiceChargeConfig);

router.delete("/:id", ServiceChargeConfigController.deleteServiceChargeConfig);

export default router;
