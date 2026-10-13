import { createFileRoute } from '@tanstack/react-router';
import { ResearchArticle } from '../../components/ResearchArticle';
import { TotalThcCalculator } from '../../components/TotalThcCalculator';
import { articleByPath } from '../../lib/articles';
import { pageHead } from '../../lib/site';

const entry = articleByPath('/learn/total-thc-formula');
export const Route = createFileRoute('/learn/total-thc-formula')({
  head: () => pageHead(entry),
  component: () => <ResearchArticle entry={entry} tool={<TotalThcCalculator/>}/>,
});
