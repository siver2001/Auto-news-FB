import { loadLogEntries } from './logger.js';

/**
 * Phân tích các chủ đề đang thịnh hành trong N ngày gần nhất
 * @param {number} days – Số ngày gần nhất để xét (default: 2)
 * @param {number} topN – Số lượng chủ đề hot muốn lấy (default: 5)
 * @returns {Array<{ topic: string, count: number }>}
 */
export function analyzeTrendingTopics(days = 2, topN = 5) {
  const logs = loadLogEntries();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const counter = {};

  for (const entry of logs) {
    if (!entry.topics || !entry.timestamp) continue;
    const time = new Date(entry.timestamp).getTime();
    if (time < cutoff) continue;

    for (const topic of entry.topics) {
      counter[topic] = (counter[topic] || 0) + 1;
    }
  }

  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([topic, count]) => ({ topic, count }));
}
