/** Choices for decorating the profile (no React here, so server and client can share it). */

export const PROFILE_EMOJIS = [
  "😀", "😎", "🤓", "🥳", "😺", "🐼", "🦊", "🐯",
  "🦁", "🐸", "🦄", "🐙", "🌟", "🔥", "🚀", "💎",
  "🌈", "🍀", "🎯", "🎧", "🏆", "💰", "🌴", "☕",
] as const;

export const BIO_MAX = 120;

/** Photos are shrunk in the browser first; this is the most the server accepts. */
export const MAX_AVATAR_BYTES = 200_000;
/** Side of the square the browser shrinks a photo to. */
export const AVATAR_SIZE = 256;
