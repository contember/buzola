// Type declarations for Navigation API and URLPattern
// These are Baseline Newly Available (Jan 2026) but not yet in TypeScript's lib.

interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

interface URLPatternResult {
  inputs: [URLPatternInit] | [URLPatternInit, string];
  protocol: URLPatternComponentResult;
  username: URLPatternComponentResult;
  password: URLPatternComponentResult;
  hostname: URLPatternComponentResult;
  port: URLPatternComponentResult;
  pathname: URLPatternComponentResult;
  search: URLPatternComponentResult;
  hash: URLPatternComponentResult;
}

declare class URLPattern {
  constructor(init: URLPatternInit);
  constructor(pattern: string, baseURL?: string);
  test(input?: URLPatternInit | string): boolean;
  exec(input?: URLPatternInit | string): URLPatternResult | null;
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

interface NavigationDestination {
  url: string;
  key: string;
  id: string;
  index: number;
  sameDocument: boolean;
  getState(): unknown;
}

interface NavigationHistoryEntry {
  url: string | null;
  key: string;
  id: string;
  index: number;
  sameDocument: boolean;
  getState(): unknown;
}

interface NavigateEvent extends Event {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  destination: NavigationDestination;
  canIntercept: boolean;
  userInitiated: boolean;
  hashChange: boolean;
  signal: AbortSignal;
  formData: FormData | null;
  downloadRequest: string | null;
  info: unknown;
  intercept(options?: {
    handler?: () => Promise<void>;
    focusReset?: 'after-transition' | 'manual';
    scroll?: 'after-transition' | 'manual';
  }): void;
  scroll(): void;
}

interface NavigationNavigateOptions {
  state?: unknown;
  info?: unknown;
  history?: 'auto' | 'push' | 'replace';
}

interface NavigationResult {
  committed: Promise<NavigationHistoryEntry>;
  finished: Promise<NavigationHistoryEntry>;
}

interface Navigation extends EventTarget {
  entries(): NavigationHistoryEntry[];
  readonly currentEntry: NavigationHistoryEntry | null;
  readonly transition: NavigationTransition | null;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  navigate(url: string, options?: NavigationNavigateOptions): NavigationResult;
  reload(options?: { state?: unknown; info?: unknown }): NavigationResult;
  traverseTo(key: string, options?: { info?: unknown }): NavigationResult;
  back(options?: { info?: unknown }): NavigationResult;
  forward(options?: { info?: unknown }): NavigationResult;
  addEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface NavigationTransition {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  from: NavigationHistoryEntry;
  finished: Promise<void>;
}

interface Window {
  navigation: Navigation;
}
