import './asyncErrors';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import garageRoutes from './routes/garages';
import quoteRoutes from './routes/quotes';
import appointmentRoutes from './routes/appointments';
import adminRoutes from './routes/admin';
import pushRoutes from './routes/push';
import configRoutes from './routes/config';
import superAdminRoutes from './routes/superadmin';
import syncRoutes from './routes/sync';
import { loadCatalog } from './serviceCatalog';

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
app.use('/api/push', pushRoutes);
app.use('/api/config', configRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/superadmin', superAdminRoutes);

// Site web super admin (build Vite de backend/admin)
const adminDir = path.join(__dirname, '../admin/dist');
if (fs.existsSync(adminDir)) {
  app.use('/admin', express.static(adminDir, { index: 'index.html' }));
  app.get('/admin/*', (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Identifiant mal formé (ex. /api/garages/abc) : erreur client, pas serveur
    if ((err as { code?: string }).code === '22P02') {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Erreur serveur' });
  }
);

loadCatalog()
  .catch((err) => console.error('Chargement du catalogue échoué :', err))
  .finally(() => {
    app.listen(config.port, () => {
      console.log(`Mekano API sur http://localhost:${config.port}`);
    });
  });
