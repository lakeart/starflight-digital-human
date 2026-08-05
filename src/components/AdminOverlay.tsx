import type { Overview, ScenicSpot } from '../data';

type AdminOverlayProps = {
  open: boolean;
  overview: Overview;
  spots: ScenicSpot[];
  onClose: () => void;
  onOverviewChange: (overview: Overview) => void;
  onSpotsChange: (spots: ScenicSpot[]) => void;
};

export function AdminOverlay({
  open,
  overview,
  spots,
  onClose,
  onOverviewChange,
  onSpotsChange,
}: AdminOverlayProps) {
  if (!open) return null;

  const updateSpot = (id: string, patch: Partial<ScenicSpot>) => {
    onSpotsChange(spots.map((spot) => (spot.id === id ? { ...spot, ...patch } : spot)));
  };

  const addSpot = () => {
    onSpotsChange([
      ...spots,
      {
        id: `node-${Date.now()}`,
        name: '新增服务节点',
        code: 'NEW NODE',
        description: '可在此配置新的民航或景区服务点',
        currentVisitors: 0,
        maxCapacity: 1000,
        status: '推荐',
      },
    ]);
  };

  return (
    <div className="admin-mask">
      <section className="admin-dialog">
        <header>
          <div>
            <h2>系统数据管理核心</h2>
            <span>ADMIN TERMINAL</span>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>

        <div className="admin-body">
          <aside>
            <button type="button" className="active">全链路基础信息</button>
            <button type="button">节点客流管理</button>
          </aside>

          <main>
            <div className="admin-title">
              <h3>项目全局配置</h3>
              <button type="button" onClick={onClose}>保存修改</button>
            </div>

            <div className="form-grid">
              <label>
                中文名称
                <input
                  value={overview.name}
                  onChange={(event) => onOverviewChange({ ...overview, name: event.target.value })}
                />
              </label>
              <label>
                英文名称
                <input
                  value={overview.englishName}
                  onChange={(event) => onOverviewChange({ ...overview, englishName: event.target.value })}
                />
              </label>
              <label>
                票价
                <input
                  type="number"
                  value={overview.ticket}
                  onChange={(event) => onOverviewChange({ ...overview, ticket: Number(event.target.value) })}
                />
              </label>
              <label>
                营业时间
                <input
                  value={overview.opening}
                  onChange={(event) => onOverviewChange({ ...overview, opening: event.target.value })}
                />
              </label>
            </div>

            <label className="wide-field">
              项目简介
              <textarea
                value={overview.summary}
                onChange={(event) => onOverviewChange({ ...overview, summary: event.target.value })}
              />
            </label>

            <div className="admin-title secondary">
              <h3>服务节点客流</h3>
              <button type="button" onClick={addSpot}>新增节点</button>
            </div>

            <div className="admin-list">
              {spots.map((spot) => (
                <div className="admin-row" key={spot.id}>
                  <input value={spot.name} onChange={(event) => updateSpot(spot.id, { name: event.target.value })} />
                  <input
                    type="number"
                    value={spot.currentVisitors}
                    onChange={(event) => updateSpot(spot.id, { currentVisitors: Number(event.target.value) })}
                  />
                  <input
                    type="number"
                    value={spot.maxCapacity}
                    onChange={(event) => updateSpot(spot.id, { maxCapacity: Number(event.target.value) })}
                  />
                  <button type="button" onClick={() => onSpotsChange(spots.filter((item) => item.id !== spot.id))}>
                    删除
                  </button>
                </div>
              ))}
            </div>
          </main>
        </div>
      </section>
    </div>
  );
}
