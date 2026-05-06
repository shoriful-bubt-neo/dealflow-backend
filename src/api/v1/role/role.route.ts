import express from "express";
import * as RoleController from "./role.controller.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { createRoleSchema, updateRoleSchema } from "./role.validation.js";

const router = express.Router();

router.post(
    "/",
    validateRequest(createRoleSchema),
    RoleController.createRole
);

router.get("/", RoleController.getRoles);

router.get("/:id", RoleController.getSingleRole);

router.patch(
    "/:id",
    validateRequest(updateRoleSchema),
    RoleController.updateRole
);

router.delete("/:id", RoleController.deleteRole);

export default router;