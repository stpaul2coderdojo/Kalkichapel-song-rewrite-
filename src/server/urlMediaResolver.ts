/**
 * Utility to resolve audio stream metadata from YouTube, SoundCloud, Spotify, and direct web links.
 */

export interface ResolvedMediaInfo {
  platform: 'youtube' | 'soundcloud' | 'spotify' | 'web';
  title: string;
  artist: string;
  externalUrl: string;
  thumbnailUrl?: string;
  videoId?: string;
  embedHtml?: string;
  description?: string;
}

export function detectUrlPlatform(url: string): 'youtube' | 'soundcloud' | 'spotify' | 'web' {
  const cleanUrl = url.trim().toLowerCase();
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (cleanUrl.includes('soundcloud.com')) {
    return 'soundcloud';
  }
  if (cleanUrl.includes('spotify.com')) {
    return 'spotify';
  }
  return 'web';
}

export function extractYouTubeVideoId(url: string): string | null {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export async function resolveUrlMediaMetadata(rawUrl: string): Promise<ResolvedMediaInfo> {
  const url = rawUrl.trim();
  const platform = detectUrlPlatform(url);

  // Helper fetch with strict timeout
  const fetchWithTimeout = async (targetUrl: string, timeoutMs = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // 1. YouTube
  if (platform === 'youtube') {
    const videoId = extractYouTubeVideoId(url);
    const standardThumbnail = videoId 
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` 
      : undefined;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetchWithTimeout(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        let rawTitle: string = data.title || 'YouTube Song';
        let authorName: string = data.author_name || 'YouTube Artist';

        // Parse "Artist - Title" format if present
        let parsedArtist = authorName.replace(/VEVO$/i, '').trim();
        let parsedTitle = rawTitle;

        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          parsedArtist = parts[0].trim();
          parsedTitle = parts.slice(1).join(' - ').trim();
        }

        // Clean up common YouTube video title clutter like "(Official Music Video)" or "[HD]"
        parsedTitle = parsedTitle
          .replace(/[\(\[](?:Official (?:Music )?Video|Audio|Lyric Video|Visualizer|HD|4K|Remastered)[\)\]]/gi, '')
          .trim();

        return {
          platform: 'youtube',
          title: parsedTitle,
          artist: parsedArtist,
          externalUrl: url,
          videoId: videoId || undefined,
          thumbnailUrl: data.thumbnail_url || standardThumbnail,
          embedHtml: data.html,
        };
      }
    } catch (e) {
      console.warn('YouTube oEmbed lookup fallback:', e);
    }

    // Fallback if oEmbed fails
    return {
      platform: 'youtube',
      title: videoId ? `YouTube Track (${videoId})` : 'YouTube Audio Stream',
      artist: 'YouTube Creator',
      externalUrl: url,
      videoId: videoId || undefined,
      thumbnailUrl: standardThumbnail,
      embedHtml: videoId ? `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="autoplay"></iframe>` : undefined,
    };
  }

  // 2. SoundCloud
  if (platform === 'soundcloud') {
    try {
      const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
      const res = await fetchWithTimeout(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        let rawTitle: string = data.title || 'SoundCloud Track';
        let author: string = data.author_name || 'SoundCloud Artist';

        let parsedTitle = rawTitle;
        if (rawTitle.toLowerCase().includes(' by ')) {
          const parts = rawTitle.split(/ by /i);
          parsedTitle = parts[0].trim();
          author = parts[1].trim() || author;
        }

        return {
          platform: 'soundcloud',
          title: parsedTitle,
          artist: author,
          externalUrl: url,
          thumbnailUrl: data.thumbnail_url,
          embedHtml: data.html,
          description: data.description,
        };
      }
    } catch (e) {
      console.warn('SoundCloud oEmbed lookup fallback:', e);
    }

    return {
      platform: 'soundcloud',
      title: 'SoundCloud Track',
      artist: 'SoundCloud Artist',
      externalUrl: url,
    };
  }

  // 3. Spotify
  if (platform === 'spotify') {
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
      const res = await fetchWithTimeout(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        return {
          platform: 'spotify',
          title: data.title || 'Spotify Track',
          artist: data.author_name || 'Spotify Artist',
          externalUrl: url,
          thumbnailUrl: data.thumbnail_url,
          embedHtml: data.html,
        };
      }
    } catch (e) {
      console.warn('Spotify oEmbed fallback:', e);
    }

    return {
      platform: 'spotify',
      title: 'Spotify Track',
      artist: 'Spotify Artist',
      externalUrl: url,
    };
  }

  // 4. Web Direct Audio or generic media URL
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'Web Audio Track';
    const cleanTitle = decodeURIComponent(filename)
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();

    return {
      platform: 'web',
      title: cleanTitle || 'Web Audio Stream',
      artist: urlObj.hostname.replace(/^www\./, ''),
      externalUrl: url,
    };
  } catch {
    return {
      platform: 'web',
      title: 'External Audio Stream',
      artist: 'Web Source',
      externalUrl: url,
    };
  }
}
