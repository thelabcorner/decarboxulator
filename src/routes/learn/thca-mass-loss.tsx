import { createFileRoute } from '@tanstack/react-router';
import { AnalyzerCalculator } from '../../components/Calculators';
import { ResearchArticle } from '../../components/ResearchArticle';
import { articleByPath } from '../../lib/articles';
import { pageHead } from '../../lib/site';

const entry = articleByPath('/learn/thca-mass-loss');
export const Route = createFileRoute('/learn/thca-mass-loss')({
  head: () => pageHead(entry),
  component: () => <ResearchArticle entry={entry} tool={<AnalyzerCalculator/>}/>,
});
