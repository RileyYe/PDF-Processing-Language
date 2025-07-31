export type BlockType = 'load' | 'select' | 'png' | 'concat' | 'save';

export type BlockCategory = 'input' | 'filter' | 'convert' | 'output' | 'control';

export type ParameterType = 'string' | 'number' | 'boolean' | 'select';

export interface Parameter {
  name: string;
  type: ParameterType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  default?: string | number | boolean;
}

export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  label: string;
  color: string;
  icon: string;
  description: string;
  parameters: Parameter[];
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface WorkspaceBlock {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  parameters: Record<string, string>;
  nextBlockId: string | null;
  previousBlockId: string | null;
}

export interface BlockConnection {
  from: string;
  to: string;
}

export interface DragItem {
  type: 'BLOCK';
  blockType: BlockType;
  blockId?: string;
  isFromToolbox?: boolean;
}