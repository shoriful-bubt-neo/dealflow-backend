import express from "express";
import * as UserController from "./user.controller.js";
import validateRequest from "../../../middlewares/validateRequest.js";
import { createUserSchema, updateUserSchema } from "./user.validation.js";

const router = express.Router();

router.post("/", validateRequest(createUserSchema), UserController.createUser);

router.get("/", UserController.getUsers);

router.get("/:id", UserController.getSingleUser);

router.patch("/:id", validateRequest(updateUserSchema), UserController.updateUser);

router.delete("/:id", UserController.deleteUser);

export default router;
