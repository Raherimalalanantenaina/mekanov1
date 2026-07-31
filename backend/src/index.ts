import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import garageRoutes from './routes/garages';
import quoteRoutes from './routes/quotes';
import appointmentRoutes from './routes/appointments';
import adminRoutes from './routes/admin';

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  })
);
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mekano-api', mode: 'online' });
});

app.use('/api/auth', authRoutes);
app.use('/api/garages', garageRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
);

app.listen(config.port, () => {
  console.log(`Mekano API sur http://localhost:${config.port}`);
});
