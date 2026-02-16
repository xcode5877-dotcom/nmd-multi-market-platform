import type { LayoutStyle } from './tenant';

export interface Template {
  id: string;
  name: string;
  layoutStyle: LayoutStyle;
  componentsPreset?: string;
  tokensPreset?: string;
}
