import { useEffect, useRef, useState } from 'react';

type CenterPanelProps = {
  openAvatarOnline: boolean;
  openAvatarStream: MediaStream | null;
};

export function CenterPanel({ openAvatarOnline, openAvatarStream }: CenterPanelProps) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [streamHasFrames, setStreamHasFrames] = useState(false);

  useEffect(() => {
    const video = videoElementRef.current;
    setStreamHasFrames(false);
    if (!video) return undefined;

    video.srcObject = openAvatarStream;
    if (openAvatarStream) {
      video.play().catch(() => undefined);
    }

    let cancelled = false;
    const checkFrames = () => {
      if (cancelled) return;
      const hasFrames = video.videoWidth > 0 && video.videoHeight > 0;
      setStreamHasFrames(hasFrames);
      if (!hasFrames && openAvatarStream) {
        window.setTimeout(checkFrames, 200);
      }
    };

    checkFrames();
    return () => {
      cancelled = true;
    };
  }, [openAvatarStream]);

  return (
    <section className="hologram-bay">
      <div className="bay-label">全息展示舱</div>
      <div className="captain-glow" />
      {openAvatarOnline && openAvatarStream ? (
        <video
          ref={videoElementRef}
          className={`openavatar-video ${streamHasFrames ? '' : 'is-hidden'}`}
          title="OpenAvatar 数字人"
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setStreamHasFrames(video.videoWidth > 0 && video.videoHeight > 0);
          }}
          onResize={(event) => {
            const video = event.currentTarget;
            setStreamHasFrames(video.videoWidth > 0 && video.videoHeight > 0);
          }}
        />
      ) : null}
      {openAvatarOnline && !streamHasFrames ? (
        <div className="openavatar-offline">
          <strong>OpenAvatar 连接中</strong>
          <span>正在建立数字人视频流。</span>
        </div>
      ) : null}
      {!openAvatarOnline ? (
        <div className="openavatar-offline">
          <strong>OpenAvatar 未启动</strong>
          <span>运行 start-openavatar.cmd 后，这里会显示数字人形象。</span>
        </div>
      ) : null}
      <div className={`wake-chip ${openAvatarOnline ? 'online' : ''}`}>
        <i />
        {openAvatarOnline ? 'OpenAvatar 数字人已连接' : 'OpenAvatar 数字人待连接'}
      </div>
      <div className="holo-ring" />
    </section>
  );
}
