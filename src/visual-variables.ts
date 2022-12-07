/**
 * Code related to visual variables.
 */
import Graph, { Attributes } from 'graphology-types';
import MultiSet from 'mnemonist/multi-set';
import Palette, { Entries, PaletteKind } from './palette';
import { scaleLinear, scaleLog, scalePow, scaleSqrt } from 'd3-scale';
import * as d3Chromatic from 'd3-scale-chromatic';

/**
 * Constants.
 */
const MAX_CATEGORICAL_COLORS = 10;
const DEFAULT_DEFAULT_CONTINUOUS_VALUE = 1;

/**
 * Types.
 */
export type Bound = number | string;
export type Range = [Bound, Bound];
export type ScaleType = 'lin' | 'log' | 'pow' | 'sqrt';
export type ScaleDefinition = [
  type: ScaleType,
  param: number | null | undefined
];

export interface AttributeScale {
  (value: Attributes): string | number;
  summary?: CategorySummary;
}

export type ConstantVisualVariable = {
  type: 'constant';
  default: string;
};

export type RawVisualVariable = {
  type: 'raw';
  attribute: string;
  default?: string;
};

export type CategoryVisualVariable = {
  type: 'category';
  attribute: string;
  palette?: Entries<string> | string;
  default?: string;
  kind?: PaletteKind;
};

export type ContinuousVisualVariable = {
  type: 'continuous';
  attribute: string;
  range: Range | string;
  default?: number;
  scale?: ScaleDefinition;
};

export type DependentVisualVariable = {
  type: 'dependent';
  value: string;
};

export type DisabledVisualVariable = {
  type: 'disabled';
};

export type VisualVariable =
  | ConstantVisualVariable
  | RawVisualVariable
  | CategoryVisualVariable
  | ContinuousVisualVariable
  | DependentVisualVariable
  | DisabledVisualVariable;

export type VisualVariables = {
  nodeColor: VisualVariable;
  nodeColorSaturation: VisualVariable;
  nodeBorderColor: VisualVariable;
  nodeBorderRatio: VisualVariable;
  nodeBorderSize: VisualVariable;
  nodeSize: VisualVariable;
  nodeLabel: VisualVariable;
  nodeLabelSize: VisualVariable;
  nodeLabelColor: VisualVariable;
  nodePictogram: VisualVariable;
  nodePictogramColor: VisualVariable;
  nodeShape: VisualVariable;
  nodeHaloSize: VisualVariable;
  nodeHaloColor: VisualVariable;
  edgeColor: VisualVariable;
  edgeSize: VisualVariable;
  edgeLabel: VisualVariable;
  edgeCurveness: VisualVariable;
  [name: string]: VisualVariable;
};

/**
 * Helper functions.
 */
function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function createD3Scale(definiton: ScaleDefinition | undefined | null) {
  if (!definiton) return scaleLinear();

  const [type, param] = definiton;

  if (type === 'lin') {
    return scaleLinear();
  }

  if (type === 'log') {
    const scale = scaleLog();

    if (param) scale.base(param);

    return scale;
  }

  if (type === 'pow') {
    const scale = scalePow();

    if (param) scale.exponent(param);
    else scale.exponent(2);

    return scale;
  }

  if (type === 'sqrt') {
    const scale = scaleSqrt();

    if (param) scale.exponent(1 / param);

    return scale;
  }

  throw new Error('unknown scale type');
}

/**
 * Helper classes.
 */
export class Extent {
  min = Infinity;
  max = -Infinity;

  add(value: number) {
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;
  }

  isConstant(): boolean {
    return this.min === Infinity || this.min === this.max;
  }
}

export class AttributeExtents {
  attributes: Record<string, Extent> = {};

  constructor(names: Array<string>) {
    // NOTE: this naturally deduplicates names
    names.forEach((name) => (this.attributes[name] = new Extent()));
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      const value = attributes[name];

      if (!isValidNumber(value)) continue;

      this.attributes[name].add(value);
    }
  }
}

export class AttributeCategories {
  attributes: Record<string, MultiSet<string>> = {};

  constructor(names: Array<string>) {
    // NOTE: this naturally deduplicates names
    names.forEach((name) => (this.attributes[name] = new MultiSet()));
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      this.attributes[name].add(attributes[name]);
    }
  }
}

export class CategorySummary {
  name: string;
  kind: PaletteKind;
  palette: Palette<string>;
  overflowing: boolean;

  constructor(
    name: string,
    kind: PaletteKind,
    palette: Palette<string>,
    overflowing: boolean = false
  ) {
    this.name = name;
    this.kind = kind;
    this.palette = palette;
    this.overflowing = overflowing;
  }

  static fromTopValues(
    name: string,
    kind: PaletteKind,
    frequencies: MultiSet<string>,
    defaultValue: string | undefined,
    scheme?: string,
    maxCount = MAX_CATEGORICAL_COLORS
  ) {
    const count = Math.min(maxCount, frequencies.dimension);
    const topValues = frequencies.top(count);
    const overflowing = count < frequencies.dimension;

    const values = topValues.map((item) => item[0]);

    const palette =
      !scheme || scheme === 'IWantHue'
        ? Palette.generateFromValues(name, kind, values, defaultValue)
        : Palette.fromScheme(name, kind, scheme, values, defaultValue);

    return new CategorySummary(name, kind, palette, overflowing);
  }

  static fromEntries(
    name: string,
    kind: PaletteKind,
    entries: Entries<string>,
    defaultValue: string | undefined
  ) {
    const palette = Palette.fromEntries(name, kind, entries, defaultValue);

    return new CategorySummary(name, kind, palette);
  }
}

export type VisualVariableScales = {
  [name: keyof VisualVariables]: AttributeScale;
};

export class VisualVariableScalesBuilder {
  variables: VisualVariables;
  nodeExtents: AttributeExtents;
  edgeExtents: AttributeExtents;
  nodeCategories: AttributeCategories;
  edgeCategories: AttributeCategories;
  maxCategories: number;

  constructor(
    visualVariables: VisualVariables,
    maxCategories = MAX_CATEGORICAL_COLORS
  ) {
    this.variables = visualVariables;
    this.maxCategories = maxCategories;

    const nodeExtentAttributes: Array<string> = [];
    const nodeCategoryAttributes: Array<string> = [];
    const edgeExtentAttributes: Array<string> = [];
    const edgeCategoryAttributes: Array<string> = [];

    for (const variableName in visualVariables) {
      const variable = visualVariables[variableName];

      if (variableName.startsWith('node')) {
        if (variable.type === 'category') {
          if (!variable.palette || typeof variable.palette === 'string')
            nodeCategoryAttributes.push(variable.attribute);
        } else if (
          variable.type === 'continuous' ||
          variableName === 'nodeSize'
        ) {
          nodeExtentAttributes.push(
            (variable as ContinuousVisualVariable).attribute
          );
        }
      } else if (variableName.startsWith('edge')) {
        if (variable.type === 'category') {
          if (!variable.palette || typeof variable.palette === 'string')
            edgeCategoryAttributes.push(variable.attribute);
        } else if (variable.type === 'continuous') {
          edgeExtentAttributes.push(variable.attribute);
        }
      }
    }

    this.nodeExtents = new AttributeExtents(nodeExtentAttributes);
    this.edgeExtents = new AttributeExtents(edgeExtentAttributes);
    this.nodeCategories = new AttributeCategories(nodeCategoryAttributes);
    this.edgeCategories = new AttributeCategories(edgeCategoryAttributes);
  }

  readGraph(graph: Graph): void {
    graph.forEachNode((node, attr) => {
      this.nodeExtents.add(attr);
      this.nodeCategories.add(attr);
    });

    graph.forEachEdge((edge, attr) => {
      this.edgeExtents.add(attr);
      this.edgeCategories.add(attr);
    });
  }

  build(): VisualVariableScales {
    const scales: VisualVariableScales = {};

    for (const variableName in this.variables) {
      const variable = this.variables[variableName];
      let scale: AttributeScale | null = null;

      // Raw variables
      if (variable.type === 'raw') {
        scale = (attr) => attr[variable.attribute] || variable.default;
      }

      // Constant variables
      else if (variable.type === 'constant') {
        scale = () => variable.default;
      }

      // Category variables
      else if (variable.type === 'category') {
        const categories = variableName.startsWith('node')
          ? this.nodeCategories
          : this.edgeCategories;

        const summary =
          variable.palette && typeof variable.palette !== 'string'
            ? CategorySummary.fromEntries(
                variable.attribute,
                variable.kind || 'color',
                variable.palette,
                variable.default
              )
            : CategorySummary.fromTopValues(
                variable.attribute,
                variable.kind || 'color',
                categories.attributes[variable.attribute],
                variable.default,
                variable.palette,
                this.maxCategories
              );

        const palette = summary.palette;

        scale = (attr) => palette.get(attr[variable.attribute]);
        scale.summary = summary;
      }

      // Continuous variables
      else if (variable.type === 'continuous') {
        const extents = variableName.startsWith('node')
          ? this.nodeExtents
          : this.edgeExtents;

        const extent = extents.attributes[variable.attribute];

        if (typeof variable.range === 'string') {
          const continuousScale = createD3Scale(variable.scale).domain([
            extent.min as number,
            extent.max as number,
          ]);

          const chromatic = (
            d3Chromatic as unknown as Record<string, (value: number) => string>
          )['interpolate' + variable.range];

          scale = (attr) => {
            const value = attr[variable.attribute];

            if (!isValidNumber(value))
              return variable.default || DEFAULT_DEFAULT_CONTINUOUS_VALUE;

            return chromatic(continuousScale(value));
          };
        } else if (
          variable.range[0] === variable.range[1] ||
          extent.isConstant()
        ) {
          scale = () =>
            isValidNumber(variable.default)
              ? variable.default
              : variable.range[0];
        } else {
          const continuousScale = createD3Scale(variable.scale)
            .domain([extent.min as number, extent.max as number])
            .range(variable.range as [number, number]);

          scale = (attr) => {
            const value = attr[variable.attribute];

            if (!isValidNumber(value))
              return variable.default || DEFAULT_DEFAULT_CONTINUOUS_VALUE;

            return continuousScale(value);
          };
        }
      }

      if (scale) scales[variableName] = scale;
    }

    return scales;
  }

  inferLabelRenderedSizeThreshold(): number {
    const variable = this.variables.nodeSize;

    if (variable.type === 'continuous') {
      const range = variable.range;

      return Math.min(6, range[0] as number);
    }

    return 6;
  }
}
