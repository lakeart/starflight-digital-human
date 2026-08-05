import type { ServiceStage } from '../data';

type RightPanelProps = {
  activeStage: ServiceStage;
  stages: ServiceStage[];
  onSelectStage: (stage: ServiceStage) => void;
};

export function RightPanel({ activeStage, stages, onSelectStage }: RightPanelProps) {
  return (
    <aside className="right-panel">
      <section className="service-panel">
        <div className="panel-heading compact">
          <h2>全链路服务列表</h2>
          <div className="bars"><span /><span /><span /></div>
        </div>
        <div className="service-list">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={`service-card ${stage.id === activeStage.id ? 'selected' : ''}`}
              onClick={() => onSelectStage(stage)}
            >
              <div className="service-icon">{stage.title.slice(0, 2)}</div>
              <div className="service-copy">
                <h3>{stage.title}</h3>
                <p>{stage.code}</p>
                <span>{stage.description}</span>
              </div>
              <em className={stage.statusType}>{stage.status}</em>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
