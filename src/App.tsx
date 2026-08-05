import { useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE_URL,
  checkBackendService,
  checkOpenAvatar,
  controlBackendService,
  requestDigitalHuman,
} from './api';
import { AdminOverlay } from './components/AdminOverlay';
import { CenterPanel } from './components/CenterPanel';
import { ChatDock, type ChatMessage } from './components/ChatDock';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { overview as initialOverview, scenicSpots, serviceStages } from './data';

const OPENAVATAR_WEBRTC_OFFER = `${API_BASE_URL}/openavatar/webrtc/offer`;

let openAvatarDataChannel: RTCDataChannel | null = null;

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function formatClock() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function createSimulatedOpenAvatarStream() {
  const stream = new MediaStream();

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const videoTrack = canvas.captureStream(15).getVideoTracks()[0];
  if (videoTrack) stream.addTrack(videoTrack);

  const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (AudioContextClass) {
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const destination = audioContext.createMediaStreamDestination();
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    const audioTrack = destination.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
  }

  return stream;
}

function emitOpenAvatarTextMessage(data: unknown) {
  const parsed = data as
    | {
        header?: { name?: string };
        payload?: {
          text?: string;
          mode?: string;
          request_id?: string;
          stream_key?: string;
          end_of_speech?: boolean;
        };
      }
    | undefined;
  const name = parsed?.header?.name;
  const payload = parsed?.payload;
  if (!payload || (name !== 'EchoAvatarText' && name !== 'EchoHumanText')) return;
  if (!payload.text && !payload.end_of_speech) return;

  window.postMessage(
    {
      type: name === 'EchoAvatarText' ? 'openavatar-avatar-text' : 'openavatar-human-text',
      text: payload.text || '',
      mode: payload.mode,
      request_id: payload.request_id,
      stream_key: payload.stream_key,
      end_of_speech: payload.end_of_speech,
    },
    '*',
  );
}

function emitOpenAvatarPlaybackSignal(data: unknown) {
  const parsed = data as
    | {
        header?: { name?: string };
        payload?: {
          type?: string;
          stream_type?: string;
          stream_key?: string;
        };
      }
    | undefined;
  const payload = parsed?.payload;
  if (
    parsed?.header?.name !== 'ChatSignal' ||
    payload?.type !== 'stream_begin' ||
    payload.stream_type !== 'client_playback'
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('openavatar-playback-start', {
      detail: { streamKey: payload.stream_key || '' },
    }),
  );
}

async function startOpenAvatarWebRTC(onRemoteStream: (stream: MediaStream | null) => void) {
  const peerConnection = new RTCPeerConnection();
  const localStream = createSimulatedOpenAvatarStream();
  const remoteStream = new MediaStream();
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.addEventListener('track', (event) => {
    console.info('OpenAvatar track received', event.track.kind, event.streams.length);
    const [stream] = event.streams;
    if (stream) {
      onRemoteStream(stream);
      return;
    }
    remoteStream.addTrack(event.track);
    onRemoteStream(remoteStream);
  });

  const dataChannel = peerConnection.createDataChannel('text');
  dataChannel.addEventListener('open', () => {
    console.info('OpenAvatar data channel open');
    openAvatarDataChannel = dataChannel;
    dataChannel.send('handshake');
    dataChannel.send(JSON.stringify({ type: 'init' }));
  });
  dataChannel.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      emitOpenAvatarTextMessage(message);
      emitOpenAvatarPlaybackSignal(message);
    } catch {
      // Non-JSON control messages are expected during the RTC session.
    }
  });
  dataChannel.addEventListener('close', () => {
    if (openAvatarDataChannel === dataChannel) openAvatarDataChannel = null;
  });

  const webrtcId = Math.random().toString(36).slice(2);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await new Promise<void>((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const handleIceGatheringStateChange = () => {
      if (peerConnection.iceGatheringState !== 'complete') return;
      peerConnection.removeEventListener('icegatheringstatechange', handleIceGatheringStateChange);
      resolve();
    };
    peerConnection.addEventListener('icegatheringstatechange', handleIceGatheringStateChange);
    window.setTimeout(() => {
      peerConnection.removeEventListener('icegatheringstatechange', handleIceGatheringStateChange);
      resolve();
    }, 1500);
  });

  const response = await fetch(OPENAVATAR_WEBRTC_OFFER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdp: peerConnection.localDescription?.sdp || offer.sdp,
      type: peerConnection.localDescription?.type || offer.type,
      webrtc_id: webrtcId,
    }),
  });
  const answer = await response.json();
  if (!response.ok || answer?.status === 'failed') {
    throw new Error(`OpenAvatar WebRTC failed: ${response.status} ${JSON.stringify(answer)}`);
  }
  console.info('OpenAvatar WebRTC answer received', answer?.type || answer?.status || 'unknown');
  await peerConnection.setRemoteDescription(answer);

  return () => {
    if (openAvatarDataChannel === dataChannel) openAvatarDataChannel = null;
    dataChannel.close();
    localStream.getTracks().forEach((track) => track.stop());
    peerConnection.getSenders().forEach((sender) => sender.track?.stop());
    peerConnection.close();
    onRemoteStream(null);
  };
}

function postOpenAvatarText(text: string) {
  if (!openAvatarDataChannel || openAvatarDataChannel.readyState !== 'open') return false;
  const requestId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  openAvatarDataChannel.send(
    JSON.stringify({
      header: {
        name: 'SendHumanText',
        request_id: requestId,
      },
      payload: {
        request_id: requestId,
        stream_key: requestId,
        mode: 'full_text',
        text,
        end_of_speech: true,
      },
    }),
  );
  return true;
}

function postOpenAvatarReply(text: string) {
  if (!openAvatarDataChannel || openAvatarDataChannel.readyState !== 'open') return false;
  const requestId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  openAvatarDataChannel.send(
    JSON.stringify({
      header: {
        name: 'SendAvatarText',
        request_id: requestId,
      },
      payload: {
        request_id: requestId,
        stream_key: requestId,
        mode: 'full_text',
        text,
        end_of_speech: true,
      },
    }),
  );
  return true;
}

function waitForOpenAvatarDataChannel(timeoutMs = 10000) {
  return new Promise<RTCDataChannel>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (openAvatarDataChannel?.readyState === 'open') {
        window.clearInterval(timer);
        resolve(openAvatarDataChannel);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('OpenAvatar data channel is not ready'));
      }
    }, 100);
  });
}

function waitForOpenAvatarPlaybackStart(timeoutMs = 6000) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('openavatar-playback-start', handlePlaybackStart);
      resolve();
    };
    const handlePlaybackStart = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    window.addEventListener('openavatar-playback-start', handlePlaybackStart, { once: true });
  });
}

function unlockOpenAvatarPlayback() {
  const avatarVideo = document.querySelector<HTMLVideoElement>('.openavatar-video');
  if (!avatarVideo) return;
  avatarVideo.muted = false;
  void avatarVideo.play().catch(() => undefined);
}

function requestOpenAvatarReply(text: string, onPartial?: (reply: string) => void) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let reply = '';
    let lastStreamKey = '';
    let idleTimer = 0;

    const timer = window.setTimeout(() => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('message', handleMessage);
      if (reply.trim()) {
        settle(reply.trim());
      } else {
        reject(new Error('OpenAvatar reply timeout'));
      }
    }, 120000);

    function settle(reply: string) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearTimeout(idleTimer);
      window.removeEventListener('message', handleMessage);
      resolve(reply);
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data as
        | {
            type?: string;
            text?: string;
            mode?: string;
            stream_key?: string;
            end_of_speech?: boolean;
          }
        | undefined;
      if (data?.type !== 'openavatar-avatar-text') return;
      if (data.stream_key && lastStreamKey && data.stream_key !== lastStreamKey) {
        reply = '';
      }
      if (data.stream_key) lastStreamKey = data.stream_key;
      if (data.text) {
        reply = data.mode === 'increment' ? `${reply}${data.text}` : data.text;
        if (reply.trim()) onPartial?.(reply.trim());
      }
      window.clearTimeout(idleTimer);
      if (data.end_of_speech && reply.trim()) {
        settle(reply.trim());
        return;
      }
      idleTimer = window.setTimeout(() => {
        if (reply.trim()) settle(reply.trim());
      }, 900);
    }

    window.addEventListener('message', handleMessage);

    void waitForOpenAvatarDataChannel(800)
      .then(() => {
        if (!postOpenAvatarText(text)) {
          throw new Error('OpenAvatar data channel closed before sending');
        }
      })
      .catch((error) => {
        if (settled) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', handleMessage);
        reject(error);
      });
  });
}

function triggerOpenAvatarReaction(text: string) {
  postOpenAvatarText(text);
}

function App() {
  const [overview, setOverview] = useState(initialOverview);
  const [spots, setSpots] = useState(scenicSpots);
  const [activeStage, setActiveStage] = useState(serviceStages[0]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(false);
  const [openAvatarAvailable, setOpenAvatarAvailable] = useState(false);
  const [openAvatarOnline, setOpenAvatarOnline] = useState(false);
  const [openAvatarStream, setOpenAvatarStream] = useState<MediaStream | null>(null);
  const openAvatarCleanupRef = useRef<(() => void) | null>(null);
  const openAvatarRetryTimerRef = useRef<number | null>(null);
  const openAvatarConnectAttemptRef = useRef(0);
  const [isListening, setIsListening] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [clock, setClock] = useState(formatClock());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '数字向导已唤醒。我可以覆盖从出门到返程的全流程旅游体验。',
    },
  ]);

  const today = useMemo(() => new Intl.DateTimeFormat('zh-CN').format(new Date()), []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const online = await checkBackendService();
      if (!cancelled) setServiceOnline(online);
    }

    detect();
    const timer = window.setInterval(detect, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!openAvatarAvailable) {
      setOpenAvatarOnline(false);
      setOpenAvatarStream(null);
      openAvatarCleanupRef.current?.();
      openAvatarCleanupRef.current = null;
      if (openAvatarRetryTimerRef.current) {
        window.clearTimeout(openAvatarRetryTimerRef.current);
        openAvatarRetryTimerRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;
    let streamWatchTimer: number | null = null;

    const scheduleReconnect = (delay = 1200) => {
      if (cancelled || openAvatarRetryTimerRef.current) return;
      openAvatarRetryTimerRef.current = window.setTimeout(() => {
        openAvatarRetryTimerRef.current = null;
        void connect();
      }, delay);
    };

    const resetConnection = () => {
      if (streamWatchTimer) {
        window.clearTimeout(streamWatchTimer);
        streamWatchTimer = null;
      }
      openAvatarCleanupRef.current?.();
      openAvatarCleanupRef.current = null;
      setOpenAvatarStream(null);
      setOpenAvatarOnline(false);
    };

    const connect = async () => {
      if (openAvatarCleanupRef.current) return;

      const attemptId = openAvatarConnectAttemptRef.current + 1;
      openAvatarConnectAttemptRef.current = attemptId;
      resetConnection();

      try {
        const stopWebRTC = await startOpenAvatarWebRTC((stream) => {
          if (cancelled || openAvatarConnectAttemptRef.current !== attemptId) return;
          if (stream && streamWatchTimer) {
            window.clearTimeout(streamWatchTimer);
            streamWatchTimer = null;
          }
          setOpenAvatarStream(stream);
          setOpenAvatarOnline(Boolean(stream));
        });

        if (cancelled || openAvatarConnectAttemptRef.current !== attemptId) {
          stopWebRTC();
          return;
        }

        openAvatarCleanupRef.current = stopWebRTC;
        streamWatchTimer = window.setTimeout(() => {
          if (cancelled || openAvatarConnectAttemptRef.current !== attemptId) return;
          streamWatchTimer = null;
          console.warn('OpenAvatar stream is slow to produce frames; keeping the WebRTC session alive');
        }, 60000);
      } catch (error) {
        console.error('OpenAvatar WebRTC startup failed', error);
        if (!cancelled && openAvatarConnectAttemptRef.current === attemptId) {
          resetConnection();
          scheduleReconnect(10000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (streamWatchTimer) window.clearTimeout(streamWatchTimer);
      if (openAvatarRetryTimerRef.current) {
        window.clearTimeout(openAvatarRetryTimerRef.current);
        openAvatarRetryTimerRef.current = null;
      }
      resetConnection();
    };
  }, [openAvatarAvailable]);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const online = await checkOpenAvatar();
      if (!cancelled) setOpenAvatarAvailable(online);
    }

    detect();
    const timer = window.setInterval(detect, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const voiceSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }, []);

  const sendText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isThinking) return;

    setInput('');
    setIsThinking(true);
    setMessages((current) => [...current, { role: 'user', content: text }]);

    try {
      if (openAvatarOnline) {
        try {
          const streamingAssistantShown = true;
          setMessages((current) => [...current, { role: 'assistant', content: '收到。' }]);
          waitForOpenAvatarDataChannel(600)
            .then(() => {
              postOpenAvatarReply('收到。');
            })
            .catch(() => undefined);
          const reply = await requestOpenAvatarReply(text, (partialReply) => {
            setMessages((current) => {
              const next = [...current];
              for (let index = next.length - 1; index >= 0; index -= 1) {
                if (next[index].role === 'assistant') {
                  next[index] = { ...next[index], content: partialReply };
                  break;
                }
              }
              return next;
            });
          });
          setServiceOnline(true);
          setMessages((current) => {
            if (!streamingAssistantShown) return [...current, { role: 'assistant', content: reply }];
            const next = [...current];
            for (let index = next.length - 1; index >= 0; index -= 1) {
              if (next[index].role === 'assistant') {
                next[index] = { ...next[index], content: reply };
                break;
              }
            }
            return next;
          });
          return;
        } catch (error) {
          console.error('OpenAvatar streaming reply failed, falling back to backend', error);
        }
      }
      const reply = await requestDigitalHuman(text, activeStage);
      setServiceOnline(true);
      if (openAvatarOnline) {
        try {
          await waitForOpenAvatarDataChannel(800);
          postOpenAvatarReply(reply);
        } catch (error) {
          console.error('OpenAvatar playback failed', error);
        }
      }
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (error) {
      const online = await checkBackendService();
      setServiceOnline(online);
      const message = error instanceof Error ? error.message : String(error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: online
            ? `API 接口调用失败：${message}`
            : '后端服务未连接，请先启动本地后端服务。',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const send = () => {
    unlockOpenAvatarPlayback();
    void sendText(input);
  };

  const handleVoiceInput = () => {
    if (!voiceSupported || isListening || isThinking) return;
    unlockOpenAvatarPlayback();

    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    setIsListening(true);

    recognition.onresult = (event) => {
      let transcript = '';
      let finalTranscript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result[0]?.transcript || '';
        if (result.isFinal) finalTranscript += result[0]?.transcript || '';
      }

      const spokenText = (finalTranscript || transcript).trim();
      if (spokenText) setInput(spokenText);
      if (finalTranscript.trim()) void sendText(finalTranscript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleServiceCheck = async () => {
    try {
      await controlBackendService('start');
      const online = await checkBackendService();
      setServiceOnline(online);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: online
            ? '后端服务已连接；OpenAvatar 在线时将优先由数字人会话回复并播报。'
            : '后端服务暂未连接。',
        },
      ]);
    } catch {
      setServiceOnline(false);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: '后端服务未启动，请先启动本地后端服务。' },
      ]);
    }
  };

  return (
    <main className="aviation-console">
      <div className="grid-layer" />

      <header className="console-header">
        <div className="clock-block">
          <strong>{clock}</strong>
          <span>{today}</span>
        </div>
        <div className="title-block">
          <h1>民航文旅数字人体验平台</h1>
          <div className="kernel">
            <span /> SYS_KERNEL&nbsp;&nbsp;V3.0 <span />
          </div>
        </div>
        <button className="console-button" type="button" onClick={() => setAdminOpen(true)}>
          控制台
        </button>
      </header>

      <section className="console-layout three-panel">
        <LeftPanel overview={overview} spots={spots} />
        <CenterPanel openAvatarOnline={openAvatarOnline} openAvatarStream={openAvatarStream} />
        <RightPanel
          activeStage={activeStage}
          stages={serviceStages}
          onSelectStage={setActiveStage}
        />
      </section>

      <ChatDock
        activeStage={activeStage}
        messages={messages}
        input={input}
        isThinking={isThinking}
        serviceOnline={serviceOnline}
        onInput={setInput}
        onSend={send}
        onVoiceInput={handleVoiceInput}
        onServiceCheck={handleServiceCheck}
        isListening={isListening}
        voiceSupported={voiceSupported}
      />

      <AdminOverlay
        open={adminOpen}
        overview={overview}
        spots={spots}
        onClose={() => setAdminOpen(false)}
        onOverviewChange={setOverview}
        onSpotsChange={setSpots}
      />
    </main>
  );
}

export default App;

