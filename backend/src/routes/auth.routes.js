import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, loginCon360 } from '../controllers/auth.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Probá de nuevo en unos minutos.' },
});

router.post('/login', loginLimiter, login);
router.post('/login-360', loginLimiter, loginCon360);

export default router;
