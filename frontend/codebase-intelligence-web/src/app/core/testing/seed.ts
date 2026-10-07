import { analyzeRepository } from '../analyzer';
import { GitHubClient } from '../github-client';
import { RepoFacts } from '../models';
import { fakeFetch, FakeRepo, SHOP_REPO } from './fake-github';

/** Real analysis of the fake repository, for tests that need facts. */
export async function shopFacts(repo: FakeRepo = SHOP_REPO): Promise<RepoFacts> {
  return analyzeRepository(
    { owner: repo.owner, repo: repo.repo },
    new GitHubClient({ fetchFn: fakeFetch(repo) }),
  );
}
