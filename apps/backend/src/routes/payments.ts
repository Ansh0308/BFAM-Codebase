import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { cashPaymentSchema, initiateGatewayPaymentSchema } from '../validation/schemas';
import {
  initiateGatewayPayment,
  listPaymentsForUser,
  recordCashPayment,
} from '../services/paymentService';
import {
  GatewayNotConfiguredError,
  InvalidPaymentStateError,
  ObligationNotFoundError,
} from '../domain/errors';

const router = Router();

// POST /payments/razorpay/order — starts a UPI or Payment Gateway payment
// (PRD §12.16): creates a real Razorpay order and a PENDING `payments` row.
// The mobile client opens Razorpay Checkout with the returned order_id/
// key_id; POST /payments/razorpay/webhook (app.ts) confirms the result.
router.post(
  '/razorpay/order',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = initiateGatewayPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid payment payload', status: 400, details: parsed.error.flatten() },
      });
    }

    try {
      const result = await initiateGatewayPayment(
        parsed.data.obligation_ids,
        req.auth!.sub,
        parsed.data.payment_method,
      );
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof ObligationNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      if (error instanceof InvalidPaymentStateError) {
        return res.status(409).json({ error: { message: error.message, status: 409 } });
      }
      if (error instanceof GatewayNotConfiguredError) {
        return res.status(503).json({ error: { message: error.message, status: 503 } });
      }
      throw error;
    }
  }),
);

// POST /payments/cash — records a cash payment (this module's requirement
// 3): SUCCESS immediately, collected_by = whoever is authenticated and
// recording it (staff at the turf, or the captain collecting from
// teammates), cash_reference optional.
router.post(
  '/cash',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = cashPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid cash payment payload',
          status: 400,
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const payment = await recordCashPayment(
        parsed.data.obligation_ids,
        req.auth!.sub,
        req.auth!.sub,
        parsed.data.cash_reference,
      );
      return res.status(201).json(payment);
    } catch (error) {
      if (error instanceof ObligationNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      if (error instanceof InvalidPaymentStateError) {
        return res.status(409).json({ error: { message: error.message, status: 409 } });
      }
      throw error;
    }
  }),
);

// GET /payments/mine — Payment History (this module's requirement 6): mode,
// status, collected_by (for cash), and reference for every transaction the
// caller paid or collected.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const payments = await listPaymentsForUser(req.auth!.sub);
    return res.status(200).json({ results: payments });
  }),
);

export default router;
