import { useEffect, useRef } from 'react';
import type { ServiceStage } from '../data';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatDockProps = {
  activeStage: ServiceStage;
  messages: ChatMessage[];
  input: string;
  isThinking: boolean;
  serviceOnline: boolean;
  isListening: boolean;
  voiceSupported: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onVoiceInput: () => void;
  onServiceCheck: () => void;
};

export function ChatDock({
  activeStage,
  messages,
  input,
  isThinking,
  serviceOnline,
  isListening,
  voiceSupported,
  onInput,
  onSend,
  onVoiceInput,
  onServiceCheck,
}: ChatDockProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isThinking]);

  return (
    <footer className="chat-dock compact">
      <div className="chat-log" ref={logRef}>
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.content.slice(0, 8)}`}>
            {message.content}
          </div>
        ))}
        {isThinking && <div className="message assistant">数字人正在生成回复...</div>}
      </div>

      <div className="chat-actions">
        <button type="button" className={serviceOnline ? 'online' : ''} onClick={onServiceCheck}>
          {serviceOnline ? '后端服务已连接' : '启动服务'}
        </button>
      </div>

      <div className="chat-input">
        <span>{activeStage.title}</span>
        <input
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSend();
          }}
          placeholder="向数字人发送航班、机场、景区路线或返程问题..."
        />
        <button
          type="button"
          className={isListening ? 'voice-recording' : 'voice-button'}
          onClick={onVoiceInput}
          disabled={!voiceSupported || isThinking}
          title={voiceSupported ? '语音输入' : '当前浏览器不支持语音输入'}
        >
          {isListening ? '聆听' : '语音'}
        </button>
        <button type="button" onClick={onSend} disabled={isThinking}>
          发送
        </button>
      </div>
    </footer>
  );
}
