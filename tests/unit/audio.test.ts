import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSound, playSound, resetAudioStateForTests } from "../../src/audio";

type MockBufferSource = {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
};

type MockAudioContextState = {
  state: AudioContextState;
  destination: AudioDestinationNode;
  decodeAudioData: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
};

function createMockAudioContext(state: AudioContextState = "running"): {
  context: AudioContext;
  state: MockAudioContextState;
  sourceNode: MockBufferSource;
} {
  const sourceNode: MockBufferSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn()
  };

  const contextState: MockAudioContextState = {
    state,
    destination: {} as AudioDestinationNode,
    decodeAudioData: vi.fn(),
    createBufferSource: vi.fn(() => sourceNode),
    resume: vi.fn().mockResolvedValue(undefined)
  };

  const context = contextState as unknown as AudioContext;
  return { context, state: contextState, sourceNode };
}

function setAudioContextConstructor(createContext: () => AudioContext): void {
  const audioContextCtor = vi.fn(function mockAudioContextConstructor() {
    return createContext();
  });

  Object.defineProperty(window, "AudioContext", {
    value: audioContextCtor,
    configurable: true,
    writable: true
  });
}

describe("audio helpers", () => {
  beforeEach(() => {
    resetAudioStateForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null from loadSound when AudioContext is unavailable", async () => {
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true,
      writable: true
    });

    const sound = await loadSound("/sounds/woosh.ogg");
    expect(sound).toBeNull();
  });

  it("loads and decodes sound once per URL", async () => {
    const { context, state } = createMockAudioContext();
    const decodedBuffer = {} as AudioBuffer;
    state.decodeAudioData.mockResolvedValue(decodedBuffer);

    setAudioContextConstructor(() => context);

    const fakeArrayBuffer = new ArrayBuffer(8);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: vi.fn().mockResolvedValue(fakeArrayBuffer)
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstLoad = await loadSound("/sounds/woosh.ogg");
    const secondLoad = await loadSound("/sounds/woosh.ogg");

    expect(firstLoad).toBe(decodedBuffer);
    expect(secondLoad).toBe(decodedBuffer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it("plays decoded buffers through the shared audio context", () => {
    const { context, state, sourceNode } = createMockAudioContext();
    setAudioContextConstructor(() => context);

    const buffer = {} as AudioBuffer;
    const played = playSound(buffer);

    expect(played).toBe(true);
    expect(state.createBufferSource).toHaveBeenCalledTimes(1);
    expect(sourceNode.buffer).toBe(buffer);
    expect(sourceNode.connect).toHaveBeenCalledWith(state.destination);
    expect(sourceNode.start).toHaveBeenCalledWith(0);
  });

  it("attempts to resume suspended audio contexts before playback", () => {
    const { context, state } = createMockAudioContext("suspended");
    setAudioContextConstructor(() => context);

    const buffer = {} as AudioBuffer;
    const played = playSound(buffer);

    expect(played).toBe(true);
    expect(state.resume).toHaveBeenCalledTimes(1);
  });
});