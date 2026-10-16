// Toată configurarea vine din variabile de mediu (compose, CI), nu din cod.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? "info",
  gpsPollSeconds: Number(process.env.GPS_POLL_SECONDS ?? 10),
  speedKmh: Number(process.env.SPEED_KMH ?? 90),
  // 1 = timp real; 60 = un minut de demo înseamnă o oră de drum
  simSpeedup: Number(process.env.SIM_SPEEDUP ?? 1),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    user: process.env.DB_USER ?? "fleet",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "fleet",
  },
  redisUrl: `redis://${process.env.REDIS_HOST ?? "localhost"}:6379`,
};
