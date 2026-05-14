declare module "d3-force-3d" {
  interface CollideForce<N> {
    (alpha: number): void;
    initialize: (nodes: N[]) => void;
    radius(r: number | ((node: N, i: number) => number)): CollideForce<N>;
    strength(s: number): CollideForce<N>;
    iterations(n: number): CollideForce<N>;
  }

  interface LinkForce<N, L> {
    (alpha: number): void;
    initialize: (nodes: N[]) => void;
    links(l: L[]): LinkForce<N, L>;
    id(fn: (node: N) => string): LinkForce<N, L>;
    distance(d: number | ((link: L) => number)): LinkForce<N, L>;
    strength(s: number | ((link: L) => number)): LinkForce<N, L>;
    iterations(n: number): LinkForce<N, L>;
  }

  interface ManyBodyForce<N> {
    (alpha: number): void;
    initialize: (nodes: N[]) => void;
    strength(s: number | ((node: N) => number)): ManyBodyForce<N>;
    distanceMin(d: number): ManyBodyForce<N>;
    distanceMax(d: number): ManyBodyForce<N>;
    theta(t: number): ManyBodyForce<N>;
  }

  interface CenterForce<N> {
    (alpha: number): void;
    initialize: (nodes: N[]) => void;
    x(x: number): CenterForce<N>;
    y(y: number): CenterForce<N>;
  }

  interface Simulation<N> {
    tick(iterations?: number): Simulation<N>;
    stop(): Simulation<N>;
    restart(): Simulation<N>;
    nodes(nodes: N[]): Simulation<N>;
    force<F>(name: string, force: F | null): Simulation<N>;
    alpha(a: number): Simulation<N>;
    alphaDecay(a: number): Simulation<N>;
    alphaMin(a: number): Simulation<N>;
    velocityDecay(v: number): Simulation<N>;
  }

  export function forceSimulation<N>(nodes: N[], nDim?: number): Simulation<N>;
  export function forceCollide<N>(
    radius?: number | ((node: N, i: number) => number),
  ): CollideForce<N>;
  export function forceLink<N, L>(links?: L[]): LinkForce<N, L>;
  export function forceManyBody<N>(): ManyBodyForce<N>;
  export function forceCenter<N>(x?: number, y?: number): CenterForce<N>;
}
