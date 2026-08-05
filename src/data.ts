export type ComfortLevel = '畅通' | '适中' | '拥挤';

export type ServiceStage = {
  id: string;
  title: string;
  code: string;
  description: string;
  status: string;
  statusType: 'good' | 'busy';
};

export type ScenicSpot = {
  id: string;
  name: string;
  code: string;
  description: string;
  currentVisitors: number;
  maxCapacity: number;
  status: '推荐' | '适中' | '繁忙';
};

export type Overview = {
  name: string;
  englishName: string;
  summary: string;
  ticket: number;
  opening: string;
  weather: string;
  flight: string;
};

export const overview: Overview = {
  name: '航空+文旅全链路目的地',
  englishName: 'AVIATION TOURISM FULL-JOURNEY GUIDE',
  summary:
    '围绕行前、机场、飞行、落地景区、返程构建连续式数字人服务。旅客从规划、出行、游览到返程，都由同一个智能机长向导陪伴。',
  ticket: 222,
  opening: '08:00 - 18:00',
  weather: '24°C 晴 | AQI 20',
  flight: 'CA1234 / T3 / 32B',
};

export const serviceStages: ServiceStage[] = [
  {
    id: 'pretrip',
    title: '行前规划',
    code: 'PRE-TRIP PLAN',
    description: '目的地推荐、航班筛选、机票预订指引、景区路线定制',
    status: '良好畅通',
    statusType: 'good',
  },
  {
    id: 'airport',
    title: '机场导引',
    code: 'AIRPORT GUIDE',
    description: '值机柜台、安检排队、登机口路线、航班动态提醒',
    status: '适中平稳',
    statusType: 'busy',
  },
  {
    id: 'flight',
    title: '飞行讲解',
    code: 'IN-FLIGHT INTRO',
    description: '机上目的地文化讲解、景区攻略、游玩注意事项',
    status: '良好畅通',
    statusType: 'good',
  },
  {
    id: 'scenic',
    title: '落地景区',
    code: 'SCENIC ARRIVAL',
    description: '景区问答、景点讲解、个性化路线推荐、语音导览',
    status: '适中平稳',
    statusType: 'busy',
  },
  {
    id: 'return',
    title: '返程服务',
    code: 'RETURN SERVICE',
    description: '返程航班提醒、机场交通指引、值机预约、旅程复盘',
    status: '良好畅通',
    statusType: 'good',
  },
];

export const scenicSpots: ScenicSpot[] = [
  {
    id: 'gate',
    name: '空港出发大厅',
    code: 'AIRPORT HALL',
    description: '值机、安检、登机口导引与航班动态提醒',
    currentVisitors: 1180,
    maxCapacity: 3000,
    status: '推荐',
  },
  {
    id: 'cloud',
    name: '云海观景台',
    code: 'SEA OF CLOUDS',
    description: '目的地核心观景点，适合日出讲解与摄影路线',
    currentVisitors: 920,
    maxCapacity: 1500,
    status: '适中',
  },
  {
    id: 'temple',
    name: '千年古刹',
    code: 'ANCIENT TEMPLE',
    description: '历史文化讲解、建筑故事与步行导航',
    currentVisitors: 640,
    maxCapacity: 900,
    status: '繁忙',
  },
  {
    id: 'return',
    name: '返程交通枢纽',
    code: 'RETURN HUB',
    description: '机场交通、返程航班提醒与值机预约',
    currentVisitors: 520,
    maxCapacity: 1800,
    status: '推荐',
  },
];

export function getComfort(current: number, max: number): ComfortLevel {
  const ratio = max > 0 ? current / max : 0;
  if (ratio >= 0.75) return '拥挤';
  if (ratio >= 0.45) return '适中';
  return '畅通';
}

export function getComfortClass(level: ComfortLevel) {
  return level === '畅通' ? 'good' : level === '适中' ? 'busy' : 'crowded';
}
