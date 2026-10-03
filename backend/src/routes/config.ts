import { Router } from 'express';
import { getConfig, getLogo, getLogoVersion } from '../appSettings';
import { getCatalogVersion, getPublicCatalog } from '../serviceCatalog';

const router = Router();

/** Config publique de l'app mobile : réglages, catalogue actif, logo. */
router.get('/', async (_req, res, next) => {
  try {
    const { config, updatedAt } = await getConfig();
    const logoVersion = await getLogoVersion();
    return res.json({
      version: `${updatedAt}-${getCatalogVersion()}-${logoVersion ?? 0}`,
      config,
      catalog: getPublicCatalog().map((c) => ({
        id: c.id,
        icon: c.icon,
        label: c.label,
        labelMg: c.labelMg,
        keywords: c.keywords,
        subtypes: c.subtypes.map((s) => ({
          id: s.id,
          label: s.label,
          labelMg: s.labelMg,
        })),
      })),
      logoUrl: logoVersion ? `/api/config/logo?v=${logoVersion}` : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logo', async (_req, res, next) => {
  try {
    const logo = await getLogo();
    const match = logo?.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(404).end();
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    next(err);
  }
});

export default router;
