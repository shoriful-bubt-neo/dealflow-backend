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
import { protectRoute } from "../../../middlewares/auth.js";
import { requireKyc } from "../../../middlewares/requireKyc.js";

const router = Router();

router.get("/code/:paymentRef", handleGetDealByCode);
router.post("/join", protectRoute, handleJoinDeal);
router.post("/", protectRoute, requireKyc({ amountFromBody: "amount" }), handleCreateDeal);

// Deal room operations (authenticated)
router.get("/:dealId/room", protectRoute, handleGetDealRoom);
router.get("/:dealId/messages", protectRoute, handleGetDealMessages);
router.post("/:dealId/messages", protectRoute, handleSendMessage);
router.patch("/:dealId/status", protectRoute, handleUpdateDealStatus);
router.post("/:dealId/payment", protectRoute, requireKyc(), handleSubmitPayment);
router.post("/:dealId/payment/initiate", protectRoute, requireKyc(), handleInitiateSslCommerzPayment);
router.post("/:dealId/payment/sslcommerz/callback", handleSslCommerzCallback);
router.post("/:dealId/deliver", protectRoute, handleMarkDelivered);
router.post("/:dealId/confirm-delivery", protectRoute, requireKyc(), handleConfirmDelivery);
router.post("/:dealId/cancel", protectRoute, handleCancelOrder);
router.post("/:dealId/agreement/accept", protectRoute, handleAcceptDealAgreement);

// Dispute (one-shot buyer → seller → admin review)
router.post("/:dealId/dispute", protectRoute, requireKyc({ isDisputeAction: true }), handleOpenDispute);
router.get("/:dealId/dispute", protectRoute, handleGetActiveDispute);
router.post(
  "/:dealId/dispute/statement",
  protectRoute,
  requireKyc({ isDisputeAction: true }),
  handleSubmitDisputeStatement,
);

export default router;
