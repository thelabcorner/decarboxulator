import { createFileRoute } from '@tanstack/react-router';
import { FormulationWorkbench } from '../../components/FormulationWorkbench';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('extract');
export const Route=createFileRoute('/tools/extract-formulation')({
  head:()=>pageHead(tool),
  component:()=> <FormulationWorkbench mode="extract"/>,
});
