export type Occurrence = {
  id: number;
  occurrence_start: string;
  occurrence_end: string;
};
export type Placed<T> = {
  event: T;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

/** Clip to the visible day and partition every overlapping cluster into columns. */
export function layoutDay<T extends Occurrence>(
  events: T[],
  date: Date,
  visibleStart = 0,
  visibleEnd = 1440,
): Placed<T>[] {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const until = new Date(from);
  until.setDate(until.getDate() + 1);
  const minutes = (d: Date) =>
    d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const result: Placed<T>[] = events
    .flatMap((event) => {
      const a = new Date(event.occurrence_start),
        b = new Date(event.occurrence_end);
      if (!(a < until && b > from && b > a)) return [];
      const start = Math.max(visibleStart, a < from ? 0 : minutes(a)),
        end = Math.min(visibleEnd, b >= until ? 1440 : minutes(b));
      if (end <= start) return [];
      return [
        { event, start, end: Math.max(start + 1, end), lane: 0, lanes: 1 },
      ];
    })
    .sort(
      (a, b) => a.start - b.start || b.end - a.end || a.event.id - b.event.id,
    );
  let cluster: Placed<T>[] = [],
    laneEnds: number[] = [],
    clusterEnd = -1;
  const flush = () => {
    cluster.forEach((item) => {
      item.lanes = laneEnds.length;
    });
    cluster = [];
    laneEnds = [];
  };
  for (const item of result) {
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    item.lane = lane;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
