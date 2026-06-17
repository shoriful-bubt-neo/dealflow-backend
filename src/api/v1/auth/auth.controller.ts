import { Request, Response } from "express";

export async function handleGetCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }

    res.status(200).json({
        success: true,
        data: {
            userId: req.user.userId ?? null,
            identityId: req.user.identityId,
            role: req.user.role,
            dealId: req.user.dealId,
        },
    });
}
