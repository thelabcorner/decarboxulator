import { createFileRoute } from '@tanstack/react-router';
import { ConversionWorkbench } from '../../components/ConversionWorkbench';
import { getTool, pageHead } from '../../lib/site';

const tool = getTool('conversion');
export const Route = createFileRoute('/tools/thca-to-thc')({
  head: () => pageHead(tool),
  component: () => <ConversionWorkbench direction="decarb"/>,
});
