import { Ratelimit, slidingWindow } from "bunlimit";
import { redis } from "bun";

export const apiRatelimit = new Ratelimit({
  redis,
  limiter: slidingWindow(300, 60),
  prefix: "ratelimit:api",
  analytics: true,
});

export const authRatelimit = new Ratelimit({
  redis,
  limiter: slidingWindow(30, 60),
  prefix: "ratelimit:auth",
  analytics: true,
});
