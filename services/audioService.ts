import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGainNode: GainNode | null = null;

/**
 * 清洗文本中的 Markdown 标记，确保 TTS 模型只接收纯文本
 */
const cleanMarkdownForTTS = (text: string): string => {
  return text
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`.*?`/g, '') // 移除行内代码
    .replace(/\*\*|__/g, '') // 移除加粗
    .replace(/#+\s+/g, '') // 移除标题标记
    .replace(/>\s+/g, '') // 移除引用标记
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接，仅保留文本
    .replace(/[-*]\s+/g, '') // 移除无序列表标记
    .replace(/\d+\.\s+/g, '') // 移除有序列表标记
    .replace(/\n+/g, ' ') // 将换行符替换为空格
    .trim();
};

// --- Helper: Retry Logic ---
const callWithRetry = async <T>(
  fn: () => Promise<T>,
  actionName: string,
  retries: number = 3,
  delay: number = 1500
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      console.error(`Failed ${actionName} after multiple attempts:`, error);
      throw error;
    }
    const attempt = 4 - retries;
    console.warn(`API Request failed (${actionName}), retrying attempt ${attempt}...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, actionName, retries - 1, delay * 1.5);
  }
};

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const stopAudio = () => {
    if (currentSource) {
        try { 
            currentSource.stop(); 
            console.debug("TTS Audio stopped manually.");
        } catch(e) {}
        currentSource = null;
    }
};

/**
 * 播放语音，支持语速和音量控制
 */
export const playTextToSpeech = async (
    text: string, 
    voiceName: string = 'Kore',
    speed: number = 1.0,
    volume: number = 1.0
) => {
    stopAudio();
    
    console.debug(`Playing TTS: Voice=${voiceName}, Speed=${speed}, Volume=${volume}`);

    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // 清洗文本以移除 Markdown 格式
    const plainText = cleanMarkdownForTTS(text);
    if (!plainText) {
        console.warn("TTS: Empty text after cleaning.");
        return;
    }

    try {
        const response = await callWithRetry<GenerateContentResponse>(
            () => ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `请朗读以下内容：${plainText}` }] }],
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName }
                        }
                    }
                }
            }),
            "TTS语音生成"
        );

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data received from Gemini API");

        const pcmBytes = decodeBase64(base64Audio);
        const audioBuffer = await decodePCM(pcmBytes, audioContext, 24000, 1);

        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = audioBuffer;
        
        // 设置语速 (仅支持 0.25 到 4 之间)
        source.playbackRate.setValueAtTime(speed, audioContext.currentTime);
        
        // 设置音量
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        currentSource = source;
        currentGainNode = gainNode;
        source.start(0);

        return new Promise<void>((resolve) => {
            source.onended = () => {
                if (currentSource === source) {
                    currentSource = null;
                    currentGainNode = null;
                }
                resolve();
            };
        });

    } catch (error) {
        console.error("TTS playTextToSpeech Error:", error);
        throw error;
    }
};