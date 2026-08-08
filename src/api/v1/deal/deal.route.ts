import { Router } from "express";
import { handleCreateDeal, handleGetDealByCode, handleJoinDeal } from "./deal.controller.js";
import {
    handleGetDealMessages,
    handleGetDealRoom,
    handleSendMessage,
    handleSubmitPayment,
    handleUpdateDealStatus,
    handleInitiateSslCommerzPayment,
    handleSslCommerzCallback,
    handleMarkDelivered,
    handleCancelOrder,
    handleConfirmDelivery,
} from "./deal.room.controller.js";
import {
    handleOpenDispute,
    handleGetActiveDispute,
    handleSubmitDisputeStatement,
} from "./deal.dispute.controller.js";
import { handleAcceptDealAgreement } from "./deal.agreement.controller.js";

const router = Router();

router.get("/code/:paymentRef", handleGetDealByCode);
router.post("/join", handleJoinDeal);
router.post("/", handleCreateDeal);

// Deal room operations (authenticated)
router.get("/:dealId/room", handleGetDealRoom);
router.get("/:dealId/messages", handleGetDealMessages);
router.post("/:dealId/messages", handleSendMessage);
router.patch("/:dealId/status", handleUpdateDealStatus);
router.post("/:dealId/payment", handleSubmitPayment);
router.post("/:dealId/payment/initiate", handleInitiateSslCommerzPayment);
router.post("/:dealId/payment/sslcommerz/callback", handleSslCommerzCallback);
router.post("/:dealId/deliver", handleMarkDelivered);
router.post("/:dealId/confirm-delivery", handleConfirmDelivery);
router.post("/:dealId/cancel", handleCancelOrder);
router.post("/:dealId/agreement/accept", handleAcceptDealAgreement);

// Dispute (one-shot buyer → seller → admin review)
router.post("/:dealId/dispute", handleOpenDispute);
router.get("/:dealId/dispute", handleGetActiveDispute);
router.post("/:dealId/dispute/statement", handleSubmitDisputeStatement);

export default router;