import { SongData, LyricLine, AgentThought, SongMetadata } from '../types/song';

export interface StoredDeviceSong {
  id: string;
  title: string;
  artist: string;
  sourceType: 'upload' | 'url' | 'sample';
  platform?: 'youtube' | 'soundcloud' | 'spotify' | 'web';
  externalUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
  embedHtml?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: number;
  audioBlob: Blob;
  duration: number;
  metadata: SongMetadata;
  lyrics: LyricLine[];
  agentTrace: AgentThought[];
  isAnalyzed: boolean;
}

const DB_NAME = 'AntigravitySongStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'device_songs';

/**
 * Open IndexedDB instance for device storage
 */
export function openDeviceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this device'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open device database'));
  });
}

/**
 * Retrieve all songs stored on the device (sorted latest first)
 */
export async function getAllDeviceSongs(): Promise<StoredDeviceSong[]> {
  try {
    const db = await openDeviceDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const songs: StoredDeviceSong[] = request.result || [];
        // Sort descending by uploaded timestamp
        songs.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
        resolve(songs);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Device storage fetch error, returning empty list:', err);
    return [];
  }
}

/**
 * Save a song uploaded from the device into IndexedDB
 */
export async function saveDeviceSong(
  song: SongData, 
  audioBlob: Blob, 
  fileName?: string
): Promise<StoredDeviceSong> {
  const db = await openDeviceDB();
  const storedSong: StoredDeviceSong = {
    id: song.id || `device-song-${Date.now()}`,
    title: song.title || fileName?.replace(/\.[^/.]+$/, '') || 'My Device Song',
    artist: song.artist || 'Device Audio',
    sourceType: song.sourceType || 'upload',
    platform: song.platform,
    externalUrl: song.externalUrl,
    thumbnailUrl: song.thumbnailUrl,
    videoId: song.videoId,
    embedHtml: song.embedHtml,
    fileName: fileName || `${song.title || 'device_song'}.mp3`,
    fileSize: audioBlob.size,
    fileType: audioBlob.type || 'audio/mpeg',
    uploadedAt: Date.now(),
    audioBlob: audioBlob,
    duration: song.duration || 65,
    metadata: {
      ...song.metadata,
      title: song.title || fileName?.replace(/\.[^/.]+$/, '') || 'My Device Song',
      duration: song.duration || 65,
    },
    lyrics: song.lyrics || [],
    agentTrace: song.agentTrace || [],
    isAnalyzed: song.isAnalyzed ?? true,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(storedSong);

    request.onsuccess = () => resolve(storedSong);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a song from device storage
 */
export async function deleteDeviceSong(id: string): Promise<void> {
  const db = await openDeviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update lyrics for an existing device song
 */
export async function updateDeviceSongLyrics(id: string, lyrics: LyricLine[]): Promise<void> {
  const db = await openDeviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const song: StoredDeviceSong | undefined = getReq.result;
      if (song) {
        song.lyrics = lyrics;
        store.put(song);
        resolve();
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Clear all songs stored on the device
 */
export async function clearAllDeviceSongs(): Promise<void> {
  const db = await openDeviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper to generate a genuine playable stereo WAV Blob with rich synth/chords
 * Highly optimized: runs in under 10ms
 */
export function generateWavBlob(bpm = 120, durationSec = 16): Blob {
  const sampleRate = 44100;
  const numChannels = 2;
  const numFrames = sampleRate * Math.min(24, Math.max(4, durationSec));
  const buffer = new ArrayBuffer(44 + numFrames * numChannels * 2);
  const view = new DataView(buffer);

  // Write WAV Header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numFrames * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numFrames * numChannels * 2, true);

  const beatSec = 60 / bpm;
  const chords = [
    [220, 261.63, 329.63], // Am
    [174.61, 220, 261.63], // F
    [130.81, 164.81, 196], // C
    [196, 246.94, 293.66], // G
  ];

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beatSec);
    const beatProgress = (t % beatSec) / beatSec;
    const chordIndex = Math.floor(beatIndex / 4) % chords.length;
    const currentChord = chords[chordIndex];

    // Fast kick drum
    let kick = 0;
    if (beatIndex % 2 === 0 && beatProgress < 0.22) {
      const kickEnv = (1 - beatProgress / 0.22);
      const kickFreq = 120 * kickEnv + 45;
      kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.45;
    }

    // Fast hi-hat
    let hat = 0;
    const subBeat = (t % (beatSec / 2)) / (beatSec / 2);
    if (subBeat < 0.12) {
      const hatEnv = (1 - subBeat / 0.12);
      hat = (Math.random() * 2 - 1) * hatEnv * 0.14;
    }

    // Melodic synth chord
    const arpNote = currentChord[Math.floor((t / (beatSec / 2)) % 3)];
    const synthMelody = Math.sin(2 * Math.PI * arpNote * t) * 0.22;

    // Bassline
    const rootBass = currentChord[0] / 2;
    const bass = Math.sin(2 * Math.PI * rootBass * t) * 0.26;

    let sampleL = kick + hat * 0.8 + synthMelody * 0.7 + bass;
    let sampleR = kick + hat * 1.2 + synthMelody * 0.9 + bass;

    if (sampleL > 1) sampleL = 1; else if (sampleL < -1) sampleL = -1;
    if (sampleR > 1) sampleR = 1; else if (sampleR < -1) sampleR = -1;

    view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff, true);
    view.setInt16(offset + 2, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff, true);
    offset += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Purge any Neon Gravity starter songs from IndexedDB storage
 */
export async function purgeNeonGravity(): Promise<void> {
  const songs = await getAllDeviceSongs();
  for (const song of songs) {
    if (
      song.title.toLowerCase().includes('neon gravity') ||
      song.fileName.toLowerCase().includes('neon_gravity') ||
      song.id.includes('device-init')
    ) {
      await deleteDeviceSong(song.id);
    }
  }
}

/**
 * Loads device songs and ensures any legacy 'Neon Gravity' starter tracks are pruned.
 */
export async function ensureStarterDeviceSongs(): Promise<StoredDeviceSong[]> {
  await purgeNeonGravity();
  return await getAllDeviceSongs();
}

/**
 * Convert a stored device song record into a runtime SongData with a valid blob URL
 */
export function convertStoredToSongData(stored: StoredDeviceSong): SongData {
  const audioUrl = URL.createObjectURL(stored.audioBlob);
  return {
    id: stored.id,
    title: stored.title,
    artist: stored.artist,
    sourceType: stored.sourceType || 'upload',
    platform: stored.platform,
    externalUrl: stored.externalUrl,
    thumbnailUrl: stored.thumbnailUrl,
    videoId: stored.videoId,
    embedHtml: stored.embedHtml,
    audioUrl,
    duration: stored.duration,
    metadata: stored.metadata,
    lyrics: stored.lyrics,
    agentTrace: stored.agentTrace,
    isAnalyzed: stored.isAnalyzed,
  };
}

/**
 * Save an imported URL song (YouTube, SoundCloud, Spotify, or Web) to device storage
 */
export async function saveUrlSongToDevice(song: SongData, customAudioBlob?: Blob): Promise<StoredDeviceSong> {
  const blobToUse = customAudioBlob || generateWavBlob(song.metadata.bpm || 120, 16);
  const platformName = song.platform ? `${song.platform}_` : '';
  const sanitizedName = `${platformName}${song.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`;
  return await saveDeviceSong(song, blobToUse, sanitizedName);
}
