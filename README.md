# Qo‘shko‘pir tuman ixtisoslashtirilgan maktab — Rasmiy portal va Admin CMS

O‘zbekiston Respublikasi davlat ta’lim muassasasi portalining zamonaviy veb-tizimi (Google Drive media ombori + Google Sheets CMS ma’lumotlar bazasi bilan).

## GitHub orqali avtomatik Deploy qilish (GitHub Pages)

1. Loyihadagi barcha fayllarni (jumladan `.github/workflows/deploy.yml`, `.npmrc`, `package-lock.json`) GitHub’ning `main` yoki `master` branch’iga yuklang (`git push`).
2. GitHub repozitoriyingizda **Settings → Pages → Build and deployment → Source** qismidan albatta **GitHub Actions** ni tanlang.
   > **Muhim:** Agar **Deploy from a branch** (`main / root`) tanlangan bo‘lsa, sahifa bo‘sh chiqadi, chunki Vite loyihasini ishga tushirish uchun **GitHub Actions** build bosqichi (`npm run build` → `dist/`) kerak bo‘ladi.
3. **Actions** bo‘limida **Deploy to GitHub Pages** workflow muvaffaqiyatli tugaganidan so‘ng sayt manzili tayyor bo‘ladi.
4. **Gmail / Google Drive ulanishi uchun:** GitHub Pages domeningizni (`https://<username>.github.io`) Firebase Console → **Authentication → Settings → Authorized domains** ro‘yxatiga qo‘shing.

## Full-Stack Deploy (Render / Railway / Cloud Run / Docker)
Express server (`server.ts`) bilan to‘liq ishga tushirish uchun `Dockerfile` va `render.yaml` tayyor:
- **Render**: GitHub repozitoriyni ulang — `render.yaml` avtomatik build va start buyruqlarini (`npm install --legacy-peer-deps && npm run build`, `node server.ts`) sozlaydi.
- **Docker**:
  ```bash
  docker build -t qoshkopir-im .
  docker run -p 3000:3000 qoshkopir-im
  ```

## Admin panelga kirish
- **Login / Parol:** `ibragim` / `!ibragim@` (Admin → Sozlamalar’dan o‘zgartirish mumkin)
- **Gmail orqali kirish:** **Admin Panel → Sozlamalar → “Gmail orqali Admin kirish ruxsati”** bo‘limidan ruxsat etilgan Gmail manzillarini qo‘shish va boshqarish mumkin (Google Sheets `Sozlamalar` jadvalida saqlanadi).
