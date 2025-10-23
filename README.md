% 2048basegm

Base mainnet üzerinde 2048 oyunu oynayıp puan + streak çarpanlarıyla GM puanı toplayabileceğiniz dApp.

% Özellikler
- Skor çarpanı: <5000=0x, 5000–9999=1x, 10000–14999=2x, 15000–19999=3x, 20000+=4x
- Streak çarpanı: Art arda gün claim ettikçe gün sayısı kadar (1.,2.,3. gün → 1x,2x,3x …). Gün kaçırılırsa 1’e reset.
- Günlük limit: 24 saatte 1 claim.
- EIP-712 backend imzalı skor ile hile önleme.
- Leaderboard: On-chain event’lerden okunup Vercel KV’ye yazılır.

% Dizayn
- contracts/GmManager.sol — Hardhat ile deploy edilen sözleşme
- web — Next.js (wagmi/viem, RainbowKit, Frog/Neynar entegrasyonu için hazır)

% Kurulum

% Ortam Değişkenleri
Kök `.env` (Hardhat):
```
PRIVATE_KEY=0x...                # deploy cüzdanı
SCORE_SIGNER_ADDRESS=0x...       # backend imza anahtarı hesabı (public)
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_SEPOLIA_RPC=https://sepolia.base.org
ETHERSCAN_API_KEY=...            # BaseScan uyumlu
```

Web `web/.env.local`:
```
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...   # deploy edilen GmManager
SIGNER_PRIVATE_KEY=0x...             # sadece backend kullanır, gizli tutun
NEYNAR_API_KEY=...                   # (opsiyonel) frame doğrulama için
KV_REST_API_URL=...                  # Vercel KV
KV_REST_API_TOKEN=...                # Vercel KV
```

% Komutlar

% Hardhat
- Derleme: `npm run compile`
- Test: `npm test`
- Sepolia deploy: `npm run deploy:sepolia`
- Mainnet deploy: `npm run deploy:base`

Not: Güncel Hardhat sürümü Node.js v22 ile sorun çıkarabilir. Node 20 LTS ile çalıştırın. Alternatif olarak Foundry ile test edebilirsiniz.

% Web
```
cd web
npm run dev          # yerel geliştirme
npm run build && npm start
```

- Skor imzalama: `POST /api/sign-score` — EIP-712 imzalı claim döner.
- Leaderboard görüntüleme: `GET /api/leaderboard?n=20`
- Event indexleme: `POST /api/reindex` — Cron ile tetikleyin.

% Akış
1) Oyun oynanır; bitince frontend `/api/sign-score` ile imzalı claim alır.
2) Kullanıcı `claimGm(claim, sig)` çağrısını Base’te gönderir.
3) Event’ler `/api/reindex` ile KV’ye aktarılır; leaderboard API gösterir.

% Olası Hatalar
- SCORE_TOO_LOW: Skor eşiği altında.
- TooManyClaimsToday: Gün içinde ikinci claim denemesi.
- DAY_MISMATCH / ClaimExpired: İmza eski veya gün uyuşmazlığı.
- InvalidSignature: Backend imzası hatalı.

