/**
 * Cliente para la API de waifu.im
 * Endpoint: https://api.waifu.im/images
 * Docs:     https://docs.waifu.im
 *
 * Parámetros correctos (camelCase, sin corchetes):
 *   includedTags  — slug del tag (ej: 'hentai', 'waifu')
 *   isNsfw        — true/false
 */
import axios from 'axios';

export interface WaifuImage {
  id:            number;
  url:           string;
  extension:     string;
  dominantColor: string;
  isNsfw:        boolean;
  isAnimated:    boolean;
  width:         number;
  height:        number;
  source:        string | null;
  artists:       { name: string; pixivUrl?: string; patreonUrl?: string }[];
  tags:          { name: string; slug: string; description?: string }[];
}

interface WaifuImResponse {
  items: WaifuImage[];
}

/**
 * Obtiene una imagen aleatoria de waifu.im por tag.
 * @param tag   Slug del tag (ej: 'waifu', 'ero', 'hentai')
 * @param nsfw  true para contenido NSFW
 */
export async function fetchWaifuImage(tag: string, nsfw: boolean): Promise<WaifuImage | null> {
  try {
    const res = await axios.get<WaifuImResponse>('https://api.waifu.im/images', {
      params: {
        includedTags: tag,
        isNsfw:       nsfw,
      },
      headers: { 'User-Agent': 'NereaBotDiscord/1.0' },
      timeout: 10_000,
    });
    return res.data.items?.[0] ?? null;
  } catch (error: any) {
    console.error(`[waifu.im] Error fetching tag "${tag}":`, error.response?.data ?? error.message);
    return null;
  }
}
