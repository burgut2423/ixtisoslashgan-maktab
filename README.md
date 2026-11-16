# Qo‘shko‘pir tuman ixtisoslashtirilgan maktab — Rasmiy portal va Admin CMS

O‘zbekiston Respublikasi davlat ta’lim muassasasi portalining zamonaviy veb-tizimi (Google Drive media ombori + Google Sheets CMS ma’lumotlar bazasi bilan).

## GitHub orqali avtomatik Deploy qilish

### 1. GitHub Pages (Avtomatik GitHub Actions)
Ushbu repozitoriyda `.github/workflows/deploy.yml` tayyor sozlangan:
1. Loyihani GitHub (`main` yoki `master` branch) ga yuklang (`git push`).
2. GitHub repozitoriy sozlamalaridan **Settings → Pages → Build and deployment → Source: GitHub Actions** ni tanlang.
3. Har safar kod yuklanganda sayt avtomatik build qilinib GitHub Pages’ga deploy qilinadi.

> **Eslatma (Gmail / Google Drive ulanishi uchun):** GitHub Pages domenini (`https://<username>.github.io`) Firebase Console → **Authentication → Settings → Authorized domains** ro‘yxatiga qo‘shib qo‘ying.

### 2. Full-Stack Deploy (Render / Railway / Cloud Run / Docker)
Express backend (`server.ts`) bilan to‘liq ishga tushirish uchun `Dockerfile` va `render.yaml` tayyor:
- **Render**: GitHub repozitoriyni ulang — `render.yaml` avtomatik build va start buyruqlarini (`npm ci && npm run build`, `node server.ts`) sozlaydi.
- **Docker**:
  ```bash
  docker build -t qoshkopir-im .
  docker run -p 3000:3000 qoshkopir-im
  ```

## Admin panelga kirish
- **Login / Parol:** `ibragim` / `!ibragim@` (yoki Admin → Sozlamalar’dan o‘zgartirish mumkin)
- **Gmail orqali kirish:** **Admin Panel → Sozlamalar → Gmail orqali Admin kirish ruxsati** bo‘limidan ruxsat etilgan Gmail manzillarini qo‘shish va boshqarish mumkin (Google Sheets `Sozlamalar` jadvalida saqlanadi).
