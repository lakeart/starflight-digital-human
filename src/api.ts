import type { ServiceStage } from './data';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api').replace(/\/$/, '');

export async function checkBackendService() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function controlBackendService(_action: 'start' | 'stop') {
  const response = await fetch(`${API_BASE_URL}/service/status`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Backend service check failed: ${response.status}`);
  return response.json();
}

export async function getOpenAvatarConfig() {
  const response = await fetch(`${API_BASE_URL}/openavatar/config`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`OpenAvatar config failed: ${response.status}`);
  return response.json();
}

export async function checkOpenAvatar() {
  try {
    const response = await fetch(`${API_BASE_URL}/openavatar/status`, { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.online);
  } catch {
    return false;
  }
}

export async function transcribeVoice(audio: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audio, `voice-${Date.now()}.webm`);
  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Voice transcription failed: ${response.status}`);
  const data = await response.json();
  return data.text || '';
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/voice/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Speech synthesis failed: ${response.status}`);
  return response.blob();
}

export function fallbackReply(question: string, stageTitle: string) {
  if (question.includes('航班') || question.includes('机票')) {
    return '我可以根据目的地、出发城市、出行日期和预算筛选航班，并同步提醒行李、值机、安检和登机注意事项。';
  }
  if (question.includes('景区') || question.includes('路线') || question.includes('讲解')) {
    return '我会根据你的兴趣偏好生成景区游览路线，并提供景点讲解、动线建议、拥挤度提醒和返程衔接服务。';
  }
  return `已进入${stageTitle}模式。我可以继续为你处理民航出行、景区导览和返程闭环服务。`;
}

export async function requestDigitalHuman(message: string, stage: ServiceStage): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/digital-human/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      stage: stage.id,
      inputMode: 'text',
      context: {
        product: '航空+文旅全链路一体化 OpenAvatar 数字人导览',
        stage: stage.title,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `API request failed: ${response.status}`);
  }
  if (!data.reply && !data.content) {
    throw new Error('API response did not include reply content');
  }
  return data.reply || data.content;
}
