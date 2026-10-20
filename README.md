# Kassa360-Ai

Point-of-sale project with React, an Express backend, AI integration and a Capacitor Android client.

## Stack

React · TypeScript · Vite · Express · Capacitor

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

Copy `.env.example` to a local `.env` file and configure the values required by your environment. Keep real credentials out of Git.

## Main areas

- Borclar
- Dashboard
- Finance
- PosSales
- Products
- Purchases
- RecurringExpenses

The development command starts the server through `tsx`. `npm run build` bundles the frontend and backend; `npm start` runs the built server. Android wrapper sources are in `android/`. Configure your own backend, database and AI service values before use.

This README describes the source layout and available scripts; it does not certify a production deployment.
