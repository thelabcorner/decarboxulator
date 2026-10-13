import { createFileRoute } from '@tanstack/react-router';
import { ResearchArticle } from '../../components/ResearchArticle';
import { PressureCalculator } from '../../components/MoreCalculators';
import { articleByPath } from '../../lib/articles';
import { pageHead } from '../../lib/site';

const entry = articleByPath('/learn/decarb-vessel-pressure');
export const Route = createFileRoute('/learn/decarb-vessel-pressure')({
  head: () => pageHead(entry),
  component: () => <ResearchArticle entry={entry} tool={<PressureCalculator/>}/>,
});
