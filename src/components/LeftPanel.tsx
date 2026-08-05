import { getComfort, getComfortClass, type Overview, type ScenicSpot } from '../data';

type LeftPanelProps = {
  overview: Overview;
  spots: ScenicSpot[];
};

export function LeftPanel({ overview, spots }: LeftPanelProps) {
  const totalVisitors = spots.reduce((sum, spot) => sum + spot.currentVisitors, 0);
  const totalCapacity = spots.reduce((sum, spot) => sum + spot.maxCapacity, 0);
  const comfort = getComfort(totalVisitors, totalCapacity);

  return (
    <aside className="left-panel">
      <section className="hero-card">
        <div className="weather-pill">{overview.weather}</div>
        <h2>{overview.name}</h2>
        <p>{overview.englishName}</p>
      </section>

      <section className="info-card">
        <h3>项目简介</h3>
        <p>{overview.summary}</p>
      </section>

      <section className="flow-card">
        <div className="card-title">
          <h3>实时客流监控</h3>
          <em>LIVE</em>
        </div>
        <div className="flow-row">
          <div>
            <span>当前全链路人数</span>
            <strong>{totalVisitors.toLocaleString()}</strong>
          </div>
          <div className={`comfort ${getComfortClass(comfort)}`}>{comfort}</div>
        </div>
        <div className="bar-chart" aria-hidden="true">
          {spots.concat(spots).map((spot, index) => (
            <i
              key={`${spot.id}-${index}`}
              style={{ height: `${22 + (spot.currentVisitors / spot.maxCapacity) * 52}px` }}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}
