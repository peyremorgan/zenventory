interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let sharedAudioContext: AudioContext | null | undefined;
const decodedSoundCache = new Map<string, Promise<AudioBuffer | null>>();

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audioContextCtor =
    window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;
  if (!audioContextCtor) {
    return null;
  }

  try {
    return new audioContextCtor();
  } catch (error) {
    console.warn("Unable to create AudioContext.", error);
    return null;
  }
}

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext === undefined) {
    sharedAudioContext = createAudioContext();
  }

  return sharedAudioContext;
}

export async function loadSound(url: string): Promise<AudioBuffer | null> {
  const existing = decodedSoundCache.get(url);
  if (existing) {
    return existing;
  }

  const loadingPromise = (async (): Promise<AudioBuffer | null> => {
    const context = getAudioContext();
    if (!context) {
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to load sound from ${url}: ${response.status} ${response.statusText}`);
        return null;
      }

      const encodedAudio = await response.arrayBuffer();
      return await context.decodeAudioData(encodedAudio.slice(0));
    } catch (error) {
      console.warn(`Failed to decode sound from ${url}.`, error);
      return null;
    }
  })();

  decodedSoundCache.set(url, loadingPromise);
  return loadingPromise;
}

export function playSound(audioBuffer: AudioBuffer | null): boolean {
  if (!audioBuffer) {
    return false;
  }

  const context = getAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    void context.resume().catch((error: unknown) => {
      console.warn("Unable to resume AudioContext before sound playback.", error);
    });
  }

  try {
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0);
    return true;
  } catch (error) {
    console.warn("Unable to play sound.", error);
    return false;
  }
}

export function resetAudioStateForTests(): void {
  sharedAudioContext = undefined;
  decodedSoundCache.clear();
}