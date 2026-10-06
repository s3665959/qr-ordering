/**
 * Image storage boundary for menu images.
 *
 * The application stores only a provider key in MenuItem.imageKey. Keeping
 * this boundary separate lets us add S3/R2/etc. later without changing the
 * menu API or UI. Until a production provider is configured, URLs and local
 * public paths are supported as a safe development fallback.
 */
export type ImageStorage = {
  publicUrl(key: string | null | undefined): string | null;
  validateKey(key: string | null | undefined): boolean;
};

const imageKeyPattern = /^(https?:\/\/[^\s]+|\/[A-Za-z0-9][A-Za-z0-9_./-]*)$/;

export const imageStorage: ImageStorage = {
  publicUrl(key) {
    if (!key || !this.validateKey(key)) return null;
    return key;
  },
  validateKey(key) {
    return !key || (key.length <= 500 && imageKeyPattern.test(key));
  },
};

export function withImageUrl<T extends { imageKey: string | null }>(item: T) {
  return { ...item, imageUrl: imageStorage.publicUrl(item.imageKey) };
}
