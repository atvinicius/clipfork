import { ElevenLabsClient } from "elevenlabs";
import { prisma } from "@ugc/db";
import { uploadToR2 } from "../lib/r2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TTSJobData {
  videoId: string;
  scenes: Array<{ text: string; duration_s: number }>;
  voiceId: string;
}

// ---------------------------------------------------------------------------
// ElevenLabs client
// ---------------------------------------------------------------------------

function getElevenLabsClient(): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY!,
  });
}

// ---------------------------------------------------------------------------
// Helper: collect readable stream into buffer
// ---------------------------------------------------------------------------

async function streamToBuffer(
  stream: NodeJS.ReadableStream | ReadableStream<Uint8Array>
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];

  if ("getReader" in stream) {
    // Web ReadableStream
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } else {
    // Node.js Readable
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
  }

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processTTSJob(job: { data: TTSJobData }) {
  const { videoId, scenes, voiceId } = job.data;

  console.log(
    `[tts] Generating audio for video ${videoId} (${scenes.length} scenes, voice: ${voiceId})`
  );

  try {
    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "GENERATING_AUDIO" },
    });

    const client = getElevenLabsClient();
    const audioUrls: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]!;

      if (!scene.text || scene.text.trim().length === 0) {
        console.log(`[tts] Skipping empty scene ${i}`);
        continue;
      }

      console.log(
        `[tts] Generating audio for scene ${i + 1}/${scenes.length}: "${scene.text.substring(0, 50)}..."`
      );

      // Generate audio with ElevenLabs
      const audioStream = await client.textToSpeech.convert(voiceId, {
        text: scene.text,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      });

      // Collect audio stream into buffer
      const audioBuffer = await streamToBuffer(audioStream as unknown as NodeJS.ReadableStream);

      // Upload to R2
      const key = `videos/${videoId}/audio/scene-${i}.mp3`;
      const url = await uploadToR2(key, audioBuffer, "audio/mpeg");
      audioUrls.push(url);

      console.log(`[tts] Scene ${i + 1} audio uploaded: ${key}`);
    }

    if (audioUrls.length === 0) {
      throw new Error("No audio was generated for any scene");
    }

    // Update Video record with audio URLs
    // Store the first audio URL as the primary audioUrl, and all URLs in the script variant
    await prisma.video.update({
      where: { id: videoId },
      data: {
        audioUrl: audioUrls[0],
      },
    });

    console.log(
      `[tts] Audio generation complete for video ${videoId}: ${audioUrls.length} files`
    );

    return {
      videoId,
      audioUrls,
    };
  } catch (error) {
    console.error(`[tts] Failed to generate audio for ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "FAILED",
        error: `TTS failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
}
