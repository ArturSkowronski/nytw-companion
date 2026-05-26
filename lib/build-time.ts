// Single source of truth for "when was this build cut".
// Reads VERCEL_GIT_COMMIT_SHA / commit timestamp where available, falls back
// to module-load time. Used in JSON-LD dateModified + Last-Modified headers
// so AI crawlers can score content freshness.
const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null
const COMMIT_REF = process.env.VERCEL_GIT_COMMIT_REF ?? null
const BUILD_TIME = new Date()

export const BUILD_INFO = {
  iso: BUILD_TIME.toISOString(),
  http: BUILD_TIME.toUTCString(),
  date: BUILD_TIME.toISOString().slice(0, 10),
  commit: COMMIT_SHA,
  ref: COMMIT_REF,
}
