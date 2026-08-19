const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i;

/** true si la URL apunta a un archivo de imagen (por extensión) — false para PDF u otros. */
export function isImageUrl(url: string | null | undefined): boolean {
  return !!url && IMAGE_EXT_RE.test(url);
}
