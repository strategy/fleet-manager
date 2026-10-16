// Adresa API-ului. Local rămâne goală: nginx trimite /api către serviciul api.
// La deploy (scripts/deploy.mjs) fișierul e rescris cu URL-ul funcției Lambda.
window.API_URL = "";
// La câte milisecunde cere pagina date noi de la API (rescris și el la deploy).
window.REFRESH_MS = 3000;
