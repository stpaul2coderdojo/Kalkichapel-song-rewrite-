import { Request, Response, Router } from 'express';
import { analyzeSongWithAgent, transformLyricsWithAgent, regenerateSongWithAgent } from './antigravityService';
import { SAMPLE_SONGS } from './sampleSongs';

export const apiRouter = Router();

// Get curated sample songs
apiRouter.get('/sample-songs', (_req: Request, res: Response) => {
  res.json({ samples: SAMPLE_SONGS });
});

// Analyze song / extract lyrics
apiRouter.post('/analyze-song', async (req: Request, res: Response) => {
  try {
    const { title, artist, sourceType, audioUrl, fileName, sampleId, audioBase64, mimeType } = req.body;
    const songData = await analyzeSongWithAgent({
      title,
      artist,
      sourceType: sourceType || 'sample',
      audioUrl,
      fileName,
      sampleId,
      audioBase64,
      mimeType,
    });
    res.json({ success: true, song: songData });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to extract song lyrics' });
  }
});

// Transform / customize lyrics
apiRouter.post('/transform-lyrics', async (req: Request, res: Response) => {
  try {
    const { currentLyrics, style, userPrompt, targetBpm, targetKey, selectedLineIds } = req.body;
    if (!currentLyrics || !Array.isArray(currentLyrics)) {
      return res.status(400).json({ success: false, error: 'currentLyrics array is required' });
    }
    const result = await transformLyricsWithAgent({
      currentLyrics,
      style: style || 'Modern Pop',
      userPrompt,
      targetBpm: targetBpm || 120,
      targetKey: targetKey || 'C Major',
      selectedLineIds,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Transform error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to transform lyrics' });
  }
});

// Regenerate song with vocals and arrangement
apiRouter.post('/regenerate-song', async (req: Request, res: Response) => {
  try {
    const { title, lyrics, vocalStyle, arrangementStyle, bpm, key } = req.body;
    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ success: false, error: 'lyrics array is required' });
    }
    const regenerated = await regenerateSongWithAgent({
      title: title || 'Custom Song',
      lyrics,
      vocalStyle: vocalStyle || 'Clean Lead',
      arrangementStyle: arrangementStyle || 'Synthwave / Cyberpop',
      bpm: bpm || 120,
      key: key || 'C Major',
    });
    res.json({ success: true, regeneratedSong: regenerated });
  } catch (error: any) {
    console.error('Regenerate error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to regenerate song' });
  }
});

// Proxy URL fetcher to bypass browser CORS for song URLs
apiRouter.post('/fetch-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    // Check if valid URL
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ success: false, error: 'Invalid URL protocol' });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ success: false, error: `Failed to fetch URL: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    res.json({
      success: true,
      audioBase64: base64,
      mimeType: contentType,
      contentLength: arrayBuffer.byteLength
    });
  } catch (err: any) {
    console.error('Fetch URL error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch audio from URL' });
  }
});
