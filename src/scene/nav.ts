import {
  NAV_EDGES,
  NAV_WAYPOINTS,
  NavEdge,
  NavWaypoint,
  Point,
  Rect,
  SCENE_OBJECTS,
  SceneObjectConfig,
  WALKABLE_ZONES
} from '../config';

export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isPointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function isPointInWalkable(p: Point, zones: readonly Rect[] = WALKABLE_ZONES): boolean {
  for (const zone of zones) {
    if (isPointInRect(p, zone)) {
      return true;
    }
  }
  return false;
}

export function clampToWalkable(
  p: Point,
  zones: readonly Rect[] = WALKABLE_ZONES,
  waypoints: readonly NavWaypoint[] = NAV_WAYPOINTS
): Point {
  if (isPointInWalkable(p, zones)) {
    return { x: p.x, y: p.y };
  }

  // Find the closest point on any walkable rectangle or closest waypoint
  let bestPoint: Point = { x: waypoints[0].x, y: waypoints[0].y };
  let minDistance = Infinity;

  for (const zone of zones) {
    const clampedX = Math.max(zone.x, Math.min(p.x, zone.x + zone.width));
    const clampedY = Math.max(zone.y, Math.min(p.y, zone.y + zone.height));
    const d = distance(p, { x: clampedX, y: clampedY });
    if (d < minDistance) {
      minDistance = d;
      bestPoint = { x: clampedX, y: clampedY };
    }
  }

  return bestPoint;
}

/**
 * Checks if a straight line between p1 and p2 stays entirely inside the walkable zones
 * by sampling points along the line segment.
 */
export function isLineWalkable(p1: Point, p2: Point, stepSize = 16): boolean {
  const d = distance(p1, p2);
  if (d <= stepSize) {
    return isPointInWalkable(p1) && isPointInWalkable(p2);
  }
  const steps = Math.ceil(d / stepSize);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt: Point = {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
    if (!isPointInWalkable(pt)) {
      return false;
    }
  }
  return true;
}

export class NavGraph {
  private waypoints: Map<string, NavWaypoint> = new Map();
  private adjacency: Map<string, string[]> = new Map();

  constructor(
    waypoints: readonly NavWaypoint[] = NAV_WAYPOINTS,
    edges: readonly NavEdge[] = NAV_EDGES
  ) {
    for (const wp of waypoints) {
      this.waypoints.set(wp.id, wp);
      this.adjacency.set(wp.id, []);
    }

    for (const edge of edges) {
      const fromList = this.adjacency.get(edge.from);
      const toList = this.adjacency.get(edge.to);
      if (fromList && toList) {
        fromList.push(edge.to);
        toList.push(edge.from);
      }
    }
  }

  public getWaypoint(id: string): NavWaypoint | undefined {
    return this.waypoints.get(id);
  }

  public getAllWaypoints(): NavWaypoint[] {
    return Array.from(this.waypoints.values());
  }

  public findNearestWaypoint(pt: Point): NavWaypoint {
    let nearest: NavWaypoint = this.waypoints.values().next().value!;
    let minDist = Infinity;

    for (const wp of this.waypoints.values()) {
      const d = distance(pt, wp);
      if (d < minDist) {
        minDist = d;
        nearest = wp;
      }
    }
    return nearest;
  }

  /**
   * Shortest path between two waypoints using Breadth-First Search / Dijkstra on the waypoint graph.
   */
  public findPathBetweenWaypoints(startId: string, endId: string): NavWaypoint[] {
    if (startId === endId) {
      const wp = this.waypoints.get(startId);
      return wp ? [wp] : [];
    }

    const queue: string[] = [startId];
    const visited = new Set<string>([startId]);
    const prev = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === endId) {
        break;
      }

      const neighbors = this.adjacency.get(current) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          prev.set(n, current);
          queue.push(n);
        }
      }
    }

    if (!prev.has(endId)) {
      // Graph disconnected or target unreachable
      const startWp = this.waypoints.get(startId);
      const endWp = this.waypoints.get(endId);
      return [startWp!, endWp!].filter(Boolean) as NavWaypoint[];
    }

    const path: NavWaypoint[] = [];
    let curr: string | undefined = endId;
    while (curr) {
      const wp = this.waypoints.get(curr);
      if (wp) path.unshift(wp);
      curr = prev.get(curr);
    }
    return path;
  }

  /**
   * Computes the complete path from start point to destination point.
   */
  public route(from: Point, to: Point): Point[] {
    // If straight line is already clear, direct path
    if (isLineWalkable(from, to)) {
      return [{ x: to.x, y: to.y }];
    }

    const startWp = this.findNearestWaypoint(from);
    const endWp = this.findNearestWaypoint(to);

    if (startWp.id === endWp.id) {
      return [{ x: startWp.x, y: startWp.y }, { x: to.x, y: to.y }];
    }

    const wpPath = this.findPathBetweenWaypoints(startWp.id, endWp.id);
    const result: Point[] = [];

    for (const wp of wpPath) {
      result.push({ x: wp.x, y: wp.y });
    }
    result.push({ x: to.x, y: to.y });

    return result;
  }
}

/**
 * Finds if a point hits any scene object's interaction hitbox.
 * Hits are prioritized by foreground layer order (reverse of SCENE_OBJECTS).
 */
export function findHitObject(
  pt: Point,
  objects: readonly SceneObjectConfig[] = SCENE_OBJECTS
): SceneObjectConfig | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (isPointInRect(pt, obj.hitbox)) {
      return obj;
    }
  }
  return null;
}
