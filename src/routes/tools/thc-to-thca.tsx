import { createFileRoute } from '@tanstack/react-router';
import { ConversionWorkbench } from '../../components/ConversionWorkbench';
import { getTool, pageHead } from '../../lib/site';

const tool = getTool('reverse-conversion');
export const Route = createFileRoute('/tools/thc-to-thca')({
  head: () => pageHead(tool),
  component: () => <ConversionWorkbench direction="reverse"/>,
});
