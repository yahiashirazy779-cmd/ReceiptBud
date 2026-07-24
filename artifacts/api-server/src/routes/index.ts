import { Router } from "express";
import healthRouter from "./health";
import receiptsRouter from "./receipts";
import budgetsRouter from "./budgets";
import dashboardRouter from "./dashboard";
import achievementsRouter from "./achievements";
import usersRouter from "./users";
import geminiRouter from "./gemini/index";
import subscriptionsRouter from "./subscriptions";

const router = Router();

router.use(healthRouter);
router.use(receiptsRouter);
router.use(budgetsRouter);
router.use(dashboardRouter);
router.use(achievementsRouter);
router.use(usersRouter);
router.use(geminiRouter);
router.use(subscriptionsRouter);

export default router;
