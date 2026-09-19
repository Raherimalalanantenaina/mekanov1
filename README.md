# Mekano

App mobile **Expo (React Native + TypeScript)** + API **Express** + **PostgreSQL** pour localiser et consulter des garages.

## Fonctionnalités

- Liste des garages (recherche, proximité GPS)
- Carte interactive
- Détail garage (appel, itinéraire)
- Rôle **garage** uniquement (inscription / connexion / publication)
- **1 compte = 1 garage** (pas de multi-fiches)
- **Validation admin** : chaque nouveau compte et chaque nouveau garage doit être validé par email (`nantenainaraherimalala@gmail.com`) avant d’être visible
- **Mode online** : sync API + cache local
- **Mode offline** : consultation du cache (AsyncStorage) + bannière hors ligne
- UI adaptable (petits et grands écrans Android)

## Structure

```
mekano/
├── mobile/          # Expo app
├── backend/         # Express API
├── assets/          # Logo Mekano
└── docker-compose.yml
```

## Prérequis

- Node 20+
- Docker (PostgreSQL)
- Expo Go sur Android (ou émulateur)

## Démarrage rapide

### 1. Base de données

```bash
docker compose up -d
```

### 2. API

```bash
cd backend
cp .env.example .env   # déjà présent si cloné tel quel
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

API : `http://localhost:4000`  
Compte démo garage : `garage@mekano.app` / `garage123`  
(autres démos : `garage2@mekano.app` … `garage4@mekano.app` — même mot de passe)

> **Persistance** : photos, devis et messages vivent dans **PostgreSQL** (volume Docker `mekano_pg`).  
> `db:seed` **ne les efface plus** — il crée / met à jour les comptes démo sans supprimer les garages existants.  
> À éviter : `docker compose down -v` (le `-v` détruit le volume et donc toute la base).

### Validation admin (comptes & garages)

À chaque inscription ou publication de garage, un email part vers `ADMIN_EMAIL`
(défaut : `nantenainaraherimalala@gmail.com`) avec deux boutons **Valider** / **Refuser**.

- Tant qu’un **compte** n’est pas validé, le propriétaire ne peut pas publier de garage.
- Tant qu’un **garage** n’est pas validé, il n’apparaît pas dans la liste / carte publique.
- Si le SMTP n’est pas configuré (`SMTP_HOST` vide), les liens de validation s’affichent dans la **console du serveur** API — tu peux les ouvrir dans un navigateur.

Pour envoyer vraiment les emails (ex. Gmail), renseigne dans `backend/.env` :

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ton.email@gmail.com
SMTP_PASS=mot-de-passe-application
PUBLIC_URL=http://IP_DE_TON_PC:4000
```

### 3. App mobile

```bash
cd mobile
npm install
npx expo start
```

Sur **émulateur Android**, l’API pointe vers `10.0.2.2:4000`.  
Sur **téléphone physique**, crée `mobile/.env` :

```
EXPO_PUBLIC_API_URL=http://IP_DE_TON_PC:4000
```

## Logo

`assets/mekano-logo.png` — teal `#0D7377` + amber `#E8A838`, pin + clé.  
Utilisé comme icône / splash dans `mobile/app.json`.

## Endpoints principaux

| Méthode | Route | Auth |
|---------|-------|------|
| GET | `/api/garages` | non |
| GET | `/api/garages/:id` | non |
| POST | `/api/auth/register` | non (rôle garage) |
| POST | `/api/auth/login` | non |
| GET | `/api/garages/mine/list` | garage |
| POST/PUT/DELETE | `/api/garages` | garage |
