import { Router } from "express";
import { handleGetCurrentUser } from "./auth.controller.js";

const router = Router();

router.get("/me", handleGetCurrentUser);

export default router;
