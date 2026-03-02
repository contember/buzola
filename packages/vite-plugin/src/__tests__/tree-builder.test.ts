import { describe, it, expect } from 'bun:test';
import { buildFileRouteTree, collectRoutePaths } from '../generator/tree-builder';
import type { ScannedFile } from '../generator/scanner';

describe('buildFileRouteTree', () => {
  it('builds a tree from flat files', () => {
    const files: ScannedFile[] = [
      { absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
      { absolutePath: '/app/src/routes/about.tsx', relativePath: 'about.tsx' },
    ];

    const tree = buildFileRouteTree(files);
    expect(tree).toHaveLength(2);

    const index = tree.find(n => n.isIndex);
    expect(index).toBeDefined();
    expect(index!.fullPath).toBe('/');

    const about = tree.find(n => n.segment === 'about');
    expect(about).toBeDefined();
    expect(about!.fullPath).toBe('/about');
  });

  it('builds nested routes with layouts', () => {
    const files: ScannedFile[] = [
      { absolutePath: '/app/src/routes/layout.tsx', relativePath: 'layout.tsx' },
      { absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
      { absolutePath: '/app/src/routes/users/layout.tsx', relativePath: 'users/layout.tsx' },
      { absolutePath: '/app/src/routes/users/index.tsx', relativePath: 'users/index.tsx' },
      { absolutePath: '/app/src/routes/users/[userId].tsx', relativePath: 'users/[userId].tsx' },
    ];

    const tree = buildFileRouteTree(files);
    expect(tree.length).toBeGreaterThan(0);
  });

  it('handles pathless groups', () => {
    const files: ScannedFile[] = [
      { absolutePath: '/app/src/routes/(auth)/login.tsx', relativePath: '(auth)/login.tsx' },
    ];

    const tree = buildFileRouteTree(files);
    const authGroup = tree.find(n => n.isPathlessGroup);
    expect(authGroup).toBeDefined();
  });

  it('handles dynamic segments', () => {
    const files: ScannedFile[] = [
      { absolutePath: '/app/src/routes/users/[userId].tsx', relativePath: 'users/[userId].tsx' },
    ];

    const tree = buildFileRouteTree(files);
    const users = tree.find(n => n.segment === 'users');
    expect(users).toBeDefined();
    expect(users!.children).toHaveLength(1);
    expect(users!.children[0].segment).toBe(':userId');
    expect(users!.children[0].fullPath).toBe('/users/:userId');
  });
});

describe('collectRoutePaths', () => {
  it('collects paths with params', () => {
    const files: ScannedFile[] = [
      { absolutePath: '/app/src/routes/index.tsx', relativePath: 'index.tsx' },
      { absolutePath: '/app/src/routes/users/[userId].tsx', relativePath: 'users/[userId].tsx' },
    ];

    const tree = buildFileRouteTree(files);
    const paths = collectRoutePaths(tree);

    expect(paths).toContainEqual({ path: '/', params: [] });
    expect(paths).toContainEqual({ path: '/users/:userId', params: ['userId'] });
  });
});
