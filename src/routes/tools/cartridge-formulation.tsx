import { createFileRoute } from '@tanstack/react-router';
import { FormulationWorkbench } from '../../components/FormulationWorkbench';
import { getTool, pageHead } from '../../lib/site';

const tool=getTool('cartridge');
export const Route=createFileRoute('/tools/cartridge-formulation')({
  head:()=>pageHead(tool),
  component:()=> <FormulationWorkbench mode="cartridge"/>,
});
