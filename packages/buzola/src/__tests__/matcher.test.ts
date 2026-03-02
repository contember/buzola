import { describe, it, expect } from 'bun:test';
import { matchRoutes } from '../engine/matcher';
import { buildRouteTree } from '../engine/route-tree';
import type { RouteConfig } from '../engine/types';

function dummyComponent() { return null; }

function createTestTree(configs: RouteConfig[]) {
  return buildRouteTree(configs);
}

describe('matchRoutes', () => {
  it('matches a simple root route', () => {
    const tree = createTestTree([
      { path: '/', component: dummyComponent, isIndex: true },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/'));
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);
    expect(matches![0].node.fullPath).toBe('/');
  });

  it('matches a static route', () => {
    const tree = createTestTree([
      { path: '/about', component: dummyComponent },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/about'));
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);
    expect(matches![0].node.fullPath).toBe('/about');
  });

  it('matches a dynamic route and extracts params', () => {
    const tree = createTestTree([
      { path: '/users/:userId', component: dummyComponent },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/users/42'));
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);
    expect(matches![0].params).toEqual({ userId: '42' });
  });

  it('matches nested routes through layouts', () => {
    const tree = createTestTree([
      {
        path: '/',
        component: dummyComponent,
        isLayout: true,
        children: [
          { path: '/', component: dummyComponent, isIndex: true },
          { path: '/about', component: dummyComponent },
        ],
      },
    ]);

    const indexMatches = matchRoutes(tree, new URL('http://localhost/'));
    expect(indexMatches).not.toBeNull();
    expect(indexMatches).toHaveLength(2); // layout + index

    const aboutMatches = matchRoutes(tree, new URL('http://localhost/about'));
    expect(aboutMatches).not.toBeNull();
    expect(aboutMatches).toHaveLength(2); // layout + about
  });

  it('matches deeply nested dynamic routes', () => {
    const tree = createTestTree([
      {
        path: '/users',
        component: dummyComponent,
        isLayout: true,
        children: [
          { path: '/', component: dummyComponent, isIndex: true },
          { path: '/:userId', component: dummyComponent },
        ],
      },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/users/99'));
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(2); // users layout + :userId
    expect(matches![1].params).toEqual({ userId: '99' });
  });

  it('extracts params from layout routes via prefixPattern', () => {
    const tree = createTestTree([
      {
        path: '/users/:userId',
        component: dummyComponent,
        isLayout: true,
        children: [
          { path: '/', component: dummyComponent, isIndex: true },
          { path: '/settings', component: dummyComponent },
        ],
      },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/users/42/settings'));
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(2);
    // Layout should extract userId param via prefixPattern
    expect(matches![0].params).toEqual({ userId: '42' });
    expect(matches![0].node.isLayout).toBe(true);
  });

  it('returns null for unmatched routes', () => {
    const tree = createTestTree([
      { path: '/about', component: dummyComponent },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/nonexistent'));
    expect(matches).toBeNull();
  });

  it('does not match partial paths', () => {
    const tree = createTestTree([
      { path: '/about', component: dummyComponent },
    ]);

    const matches = matchRoutes(tree, new URL('http://localhost/about/extra'));
    expect(matches).toBeNull();
  });
});
