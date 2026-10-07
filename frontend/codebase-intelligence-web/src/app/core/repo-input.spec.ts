import { describe, it, expect } from 'vitest';
import { parseRepoInput, RepoInputError, validateBranch } from './repo-input';

describe('parseRepoInput', () => {
  it.each([
    ['dotnet/eShop', 'dotnet', 'eShop'],
    ['  dotnet/eShop/  ', 'dotnet', 'eShop'],
    ['https://github.com/dotnet/aspnetcore', 'dotnet', 'aspnetcore'],
    ['https://github.com/dotnet/aspnetcore.git', 'dotnet', 'aspnetcore'],
    ['https://github.com/dotnet/aspnetcore/tree/main/src', 'dotnet', 'aspnetcore'],
    ['http://www.github.com/a/b', 'a', 'b'],
    ['github.com/angular/angular', 'angular', 'angular'],
    ['git@github.com:facebook/react.git', 'facebook', 'react'],
  ])('accepts %s', (input, owner, repo) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo });
  });

  it.each([
    '',
    '   ',
    'justonepart',
    'a/b/c',
    '../etc/passwd',
    'owner/..',
    'owner/re po',
    '-bad/repo',
    'https://evilgithub.com/a/b/c',
  ])('rejects %j', (input) => {
    expect(() => parseRepoInput(input)).toThrow(RepoInputError);
  });

  it('validates branch names', () => {
    expect(validateBranch(' release/1.2.x ')).toBe('release/1.2.x');
    for (const bad of ['../x', 'a b', 'a?b', '/a', 'a/', 'a//b']) {
      expect(() => validateBranch(bad)).toThrow(RepoInputError);
    }
  });
});
