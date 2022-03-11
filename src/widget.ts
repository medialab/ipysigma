import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import Graph from 'graphology';
import { SerializedGraph } from 'graphology-types';
import LayoutSupervisor from 'graphology-layout-forceatlas2/worker';
import NoverlapSupervisor from 'graphology-layout-noverlap/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2';
import louvain from 'graphology-communities-louvain';
import Sigma from 'sigma';
import { animateNodes } from 'sigma/utils/animate';
import { Settings as SigmaSettings } from 'sigma/settings';
import { CameraState, NodeDisplayData, EdgeDisplayData } from 'sigma/types';
import type Palette from 'iwanthue/palette';
import PaletteBuilder from 'iwanthue/palette-builder';
import seedrandom from 'seedrandom';
import type { Properties as CSSProperties } from 'csstype';
import comma from 'comma-number';
import Choices from 'choices.js';
import screenfull from 'screenfull';
import { scaleLinear } from 'd3-scale';
import debounce from 'debounce';

import { MODULE_NAME, MODULE_VERSION } from './version';
import drawHover from './custom-hover';
import {
  renderAsDataURL,
  saveAsPNG,
  saveAsGEXF,
  saveAsJSON,
  saveAsSVG,
} from './utils';

import {
  zoomIcon,
  unzoomIcon,
  resetZoomIcon,
  playIcon,
  pauseIcon,
  resetLayoutIcon,
  fullscreenEnterIcon,
  fullscreenExitIcon,
  scatterIcon,
} from './icons';

import 'choices.js/public/assets/styles/choices.min.css';
import '../css/widget.css';

/**
 * Constants.
 */
const CAMERA_OFFSET = 0.65;
const NODE_VIZ_ATTRIBUTES = new Set(['label', 'size', 'color', 'x', 'y']);
const EDGE_VIZ_ATTRIBUTES = new Set(['label', 'size', 'color']);
const CATEGORY_MAX_COUNT = 10;
const MUTED_NODE_COLOR = '#ccc';

/**
 * Types.
 */
type ItemType = 'node' | 'edge';
type RNGFunction = () => number;
type InformationDisplayTab = 'legend' | 'info';
type Position = { x: number; y: number };
type LayoutMapping = Record<string, Position>;
type EdgeColorDependency = 'source' | 'target';
type Bound = number | string;
type Range = [Bound, Bound];
type Scale<T> = (value: number) => T;

type RawVisualVariable = {
  type: 'raw';
  attribute: string;
};

type CategoryVisualVariable = {
  type: 'category';
  attribute: string;
};

type ContinuousVisualVariable = {
  type: 'continuous';
  attribute: string;
  range: Range;
};

type DependentVisualVariable = {
  type: 'dependent';
  value: EdgeColorDependency;
};

type VisualVariable =
  | RawVisualVariable
  | CategoryVisualVariable
  | ContinuousVisualVariable
  | DependentVisualVariable;

type VisualVariables = {
  node_color: VisualVariable;
  node_size: ContinuousVisualVariable;
  node_label: RawVisualVariable;
  edge_color: VisualVariable;
  edge_size: ContinuousVisualVariable;
  edge_label: RawVisualVariable | null;
};

interface CustomNodeDisplayData extends NodeDisplayData {
  hoverLabel?: string | null;
  categoryValue?: string;
}

/**
 * Template.
 */
const TEMPLATE = `
<div id="ipysigma-container"></div>
<div id="ipysigma-left-panel">
  <div id="ipysigma-graph-description"></div>
  <div>
    <button id="ipysigma-zoom-button" class="ipysigma-button ipysigma-svg-icon" title="zoom">
      ${zoomIcon}
    </button>
    <button id="ipysigma-unzoom-button" class="ipysigma-button ipysigma-svg-icon" title="unzoom">
      ${unzoomIcon}
    </button>
    <button id="ipysigma-reset-zoom-button" class="ipysigma-button ipysigma-svg-icon" title="reset zoom">
      ${resetZoomIcon}
    </button>
  </div>
  <div>
    <button id="ipysigma-fullscreen-button" class="ipysigma-button ipysigma-svg-icon" title="enter fullscreen">
      ${fullscreenEnterIcon}
    </button>
  </div>
  <div id="ipysigma-layout-controls">
    <button id="ipysigma-layout-button" class="ipysigma-button ipysigma-svg-icon" title="start layout">
      ${playIcon}
    </button>
    <button id="ipysigma-noverlap-button" class="ipysigma-button ipysigma-svg-icon" title="spread nodes">
      ${scatterIcon}
    </button>
    <button id="ipysigma-reset-layout-button" class="ipysigma-button ipysigma-svg-icon" title="reset layout">
      ${resetLayoutIcon}
    </button>
  </div>
</div>
<div id="ipysigma-right-panel">
  <select id="ipysigma-search">
    <option value="">Search a node...</option>
  </select>
  <div id="ipysigma-information-display">
    <div id="ipysigma-information-display-tabs">
      <em id="ipysigma-information-legend-button" class="ipysigma-tab-button">legend</em>
      &middot;
      <em id="ipysigma-information-info-button" class="ipysigma-tab-button">info</em>
    </div>
    <hr>
    <div id="ipysigma-legend"></div>
    <div id="ipysigma-information-contents"></div>
  </div>
  <div id="ipysigma-download-controls">
    <button id="ipysigma-download-png-button" class="ipysigma-button">
      png
    </button>
    <button id="ipysigma-download-svg-button" class="ipysigma-button">
      svg
    </button>
    <button id="ipysigma-download-gexf-button" class="ipysigma-button">
      gexf
    </button>
    <button id="ipysigma-download-json-button" class="ipysigma-button">
      json
    </button>
  </div>
</div>
`;

/**
 * Model declaration.
 */
export class SigmaModel extends DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: SigmaModel.model_name,
      _model_module: SigmaModel.model_module,
      _model_module_version: SigmaModel.model_module_version,
      _view_name: SigmaModel.view_name,
      _view_module: SigmaModel.view_module,
      _view_module_version: SigmaModel.view_module_version,
      data: { nodes: [], edges: [] },
      height: 500,
      start_layout: false,
      snapshot: null,
      layout: null,
      clickableEdges: false,
      visual_variables: {},
    };
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    // Add any extra serializers here
  };

  static model_name = 'SigmaModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'SigmaView'; // Set to null if no view
  static view_module = MODULE_NAME; // Set to null if no view
  static view_module_version = MODULE_VERSION;
}

/**
 * Helper functions.
 */
function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

function coerceNumericalValue(value: any): number {
  if (isValidNumber(value)) return value;
  return 1;
}

function createScale<T>(min: number, max: number, range: Range): Scale<T> {
  if (min === Infinity || min === max) {
    return () => range[0] as unknown as T;
  }

  return scaleLinear()
    .domain([min as number, max as number])
    .range(range as [number, number]) as unknown as Scale<T>;
}

function escapeHtml(unsafe: string): string {
  return ('' + unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTypedValue(value: any): string {
  const safe = escapeHtml('' + value);

  let type = 'unknown';

  if (typeof value === 'number') {
    type = 'number';
  } else if (typeof value === 'string') {
    type = 'string';
  } else if (typeof value === 'boolean') {
    type = 'boolean';
  }

  return `<span class="ipysigma-${type}" title="${type}">${safe}</span>`;
}

function applyLayout(graph: Graph, mapping: LayoutMapping): void {
  graph.updateEachNodeAttributes((node, attr) => {
    const pos = mapping[node];

    if (!pos) return attr;

    attr.x = pos.x;
    attr.y = pos.y;

    return attr;
  });
}

function collectLayout(graph: Graph): LayoutMapping {
  const mapping: LayoutMapping = {};

  graph.forEachNode((node, attr) => {
    mapping[node] = { x: attr.x, y: attr.y };
  });

  return mapping;
}

function buildGraph(data: SerializedGraph, rng: RNGFunction): Graph {
  const graph = Graph.from(data);

  // Rectifications
  graph.updateEachNodeAttributes((key, attr) => {
    // Random position for nodes without positions
    if (!isValidNumber(attr.x)) attr.x = rng();
    if (!isValidNumber(attr.y)) attr.y = rng();

    return attr;
  });

  return graph;
}

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options?: {
    className?: string | null;
    style?: CSSProperties;
    innerHTML?: string;
    title?: string;
  }
): HTMLElement {
  const element = document.createElement(tag);

  const { className, style, innerHTML, title } = options || {};

  if (className) element.setAttribute('class', className);

  for (const prop in style) {
    (<any>element.style)[prop] = (<any>style)[prop];
  }

  if (innerHTML) element.innerHTML = innerHTML;

  if (title) element.setAttribute('title', title);

  return element;
}

function hide(el: HTMLElement): void {
  el.style.display = 'none';
}

function show(el: HTMLElement): void {
  el.style.display = 'block';
}

function disable(el: HTMLButtonElement): void {
  el.classList.add('disabled');
  el.disabled = true;
}

function enable(el: HTMLButtonElement): void {
  el.classList.remove('disabled');
  el.disabled = false;
}

const SPINNER_STATES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function createSpinner(): [HTMLElement, () => void] {
  const span = createElement('span', {
    className: 'ipysigma-spinner',
    innerHTML: SPINNER_STATES[0],
  });

  let state = -1;
  let frame: ReturnType<typeof setTimeout> | null = null;

  const update = () => {
    state++;
    state %= SPINNER_STATES.length;
    span.innerHTML = SPINNER_STATES[state];

    frame = setTimeout(update, 80);
  };

  update();

  return [span, () => frame !== null && clearTimeout(frame)];
}

function getGraphDescription(graph: Graph): string {
  let graphTitle = `${graph.multi ? 'Multi ' : ''}${
    graph.type === 'undirected' ? 'Undirected' : 'Directed'
  } Graph`;

  let html = `<u>${graphTitle}</u><br><b>${comma(
    graph.order
  )}</b> nodes<br><b>${comma(graph.size)}</b> edges`;

  return html;
}

/**
 * View declaration.
 */
export class SigmaView extends DOMWidgetView {
  singleton: boolean = true;
  rng: RNGFunction;

  container: HTMLElement;
  renderer: Sigma;
  graph: Graph;
  metrics: {
    node: Record<string, string>;
  };

  originalLayoutPositions: LayoutMapping;
  layout: LayoutSupervisor;
  noverlap: NoverlapSupervisor;
  layoutButton: HTMLButtonElement;
  noverlapButton: HTMLButtonElement;
  resetLayoutButton: HTMLButtonElement;
  layoutSpinner: [HTMLElement, () => void] | null = null;
  layoutControls: HTMLElement;

  zoomButton: HTMLElement;
  unzoomButton: HTMLElement;
  resetZoomButton: HTMLElement;

  fullscreenButton: HTMLElement;

  choices: Choices;
  currentTab: InformationDisplayTab = 'legend';
  infoElement: HTMLElement;
  legendElement: HTMLElement;
  legendButton: HTMLElement;
  nodeInfoButton: HTMLElement;
  selectedNode: string | null = null;
  selectedEdge: string | null = null;
  focusedNodes: Set<string> | null = null;
  selectedNodeCategories: Set<string> | null = null;
  selectedEdgeCategories: Set<string> | null = null;

  downloadPNGButton: HTMLElement;
  downloadGEXFButton: HTMLElement;
  downloadSVGButton: HTMLElement;
  downloadJSONButton: HTMLElement;

  renderSingletonError() {
    this.el.innerHTML =
      '<i>You cannot render two independent views of the same Sigma widget, sorry...</i>';
  }

  render() {
    super.render();

    // Lock management
    if (this.model.get('singleton_lock')) {
      this.renderSingletonError();
      this.singleton = false;
      return;
    }

    this.model.set('singleton_lock', true);
    this.touch();

    this.rng = seedrandom('ipysigma');
    this.el.classList.add('ipysigma-widget');

    const height = this.model.get('height');
    const data = this.model.get('data');

    const graph = buildGraph(data, this.rng);
    this.graph = graph;

    // Preexisting layout?
    const preexistingLayout = this.model.get('layout');

    if (preexistingLayout) {
      applyLayout(graph, preexistingLayout);
    } else {
      this.saveLayout();
    }
    this.originalLayoutPositions = collectLayout(graph);

    // Widget-side metrics
    const nodeMetrics = this.model.get('node_metrics') as
      | Record<string, string>
      | undefined;

    if (nodeMetrics) {
      for (const metric in nodeMetrics) {
        if (metric === 'louvain') {
          louvain.assign(graph, {
            nodeCommunityAttribute: nodeMetrics[metric],
          });
        } else {
          throw new Error('unkown metric ' + metric);
        }
      }
    }

    this.metrics = { node: nodeMetrics || {} };

    this.el.insertAdjacentHTML('beforeend', TEMPLATE);
    this.el.style.width = '100%';
    this.el.style.height = height + 'px';

    this.container = this.el.querySelector(
      '#ipysigma-container'
    ) as HTMLElement;
    this.container.style.width = '100%';
    this.container.style.height = height + 'px';

    // Description
    const description = this.el.querySelector(
      '#ipysigma-graph-description'
    ) as HTMLElement;
    description.innerHTML = getGraphDescription(graph);

    // Camera controls
    this.zoomButton = this.el.querySelector(
      '#ipysigma-zoom-button'
    ) as HTMLElement;
    this.unzoomButton = this.el.querySelector(
      '#ipysigma-unzoom-button'
    ) as HTMLElement;
    this.resetZoomButton = this.el.querySelector(
      '#ipysigma-reset-zoom-button'
    ) as HTMLElement;

    // Fullscreen controls
    this.fullscreenButton = this.el.querySelector(
      '#ipysigma-fullscreen-button'
    ) as HTMLElement;

    // Layout controls
    this.layoutControls = this.el.querySelector(
      '#ipysigma-layout-controls'
    ) as HTMLElement;
    this.layoutButton = this.el.querySelector(
      '#ipysigma-layout-button'
    ) as HTMLButtonElement;
    this.noverlapButton = this.el.querySelector(
      '#ipysigma-noverlap-button'
    ) as HTMLButtonElement;
    this.resetLayoutButton = this.el.querySelector(
      '#ipysigma-reset-layout-button'
    ) as HTMLButtonElement;

    // Search
    var searchContainer = this.el.querySelector(
      '#ipysigma-search'
    ) as HTMLElement;

    const nodeLabelAttribute =
      this.model.get('visual_variables').node_label.attribute;

    const options = graph.mapNodes((key, attr) => {
      let labelParts = [escapeHtml(key)];

      const label = attr[nodeLabelAttribute];

      if (label && label !== key) {
        labelParts.push(
          ` <small style="font-size: 75%;">${escapeHtml(label)}</small>`
        );
      }

      return { value: key, label: labelParts.join(' ') };
    });

    this.choices = new Choices(searchContainer, {
      allowHTML: true,
      removeItemButton: true,
      renderChoiceLimit: 10,
      choices: options,
      itemSelectText: '',
      position: 'bottom',
    });

    this.infoElement = this.el.querySelector(
      '#ipysigma-information-contents'
    ) as HTMLElement;
    this.legendElement = this.el.querySelector(
      '#ipysigma-legend'
    ) as HTMLElement;

    this.nodeInfoButton = this.el.querySelector(
      '#ipysigma-information-info-button'
    ) as HTMLElement;
    this.legendButton = this.el.querySelector(
      '#ipysigma-information-legend-button'
    ) as HTMLElement;

    this.changeInformationDisplayTab('legend');

    // Download controls
    this.downloadPNGButton = this.el.querySelector(
      '#ipysigma-download-png-button'
    ) as HTMLElement;
    this.downloadGEXFButton = this.el.querySelector(
      '#ipysigma-download-gexf-button'
    ) as HTMLElement;
    this.downloadSVGButton = this.el.querySelector(
      '#ipysigma-download-svg-button'
    ) as HTMLElement;
    this.downloadJSONButton = this.el.querySelector(
      '#ipysigma-download-json-button'
    ) as HTMLElement;

    // Waiting for widget to be mounted to register events
    this.displayed.then(() => {
      const clickableEdges: boolean = this.model.get('clickable_edges');

      const rendererSettings: Partial<SigmaSettings> = {
        zIndex: true,
        defaultEdgeType: graph.type !== 'undirected' ? 'arrow' : 'line',
        enableEdgeClickEvents: clickableEdges,
        enableEdgeHoverEvents: clickableEdges,
        labelGridCellSize: 250,
        hoverRenderer: drawHover,
        defaultNodeColor: '#999',
        defaultEdgeColor: '#ccc',
      };

      // Gathering info about the graph to build reducers correctly
      const visualVariables = this.model.get(
        'visual_variables'
      ) as VisualVariables;

      // Nodes
      const nodeDisplayDataRegister: Record<
        string,
        Partial<CustomNodeDisplayData>
      > = {};

      const nodeColorAttribute =
        (<any>visualVariables.node_color).attribute || 'color';

      const nodePaletteBuilder: PaletteBuilder<string> | null =
        visualVariables.node_color.type === 'category'
          ? new PaletteBuilder(nodeColorAttribute, CATEGORY_MAX_COUNT, {
              defaultColor: rendererSettings.defaultNodeColor,
            })
          : null;

      const nodeSizeAttribute =
        visualVariables.node_size.type === 'continuous'
          ? visualVariables.node_size.attribute
          : 'size';

      const needToComputeNodeColorExtent =
        visualVariables.node_color.type === 'continuous';

      let minNodeSize = Infinity;
      let maxNodeSize = -Infinity;
      let minNodeColor = Infinity;
      let maxNodeColor = -Infinity;

      const nodeLabelAttribute = visualVariables.node_label.attribute;

      graph.forEachNode((node, attr) => {
        if (nodePaletteBuilder) {
          nodePaletteBuilder.add(attr[nodeColorAttribute]);
        } else if (needToComputeNodeColorExtent) {
          const color = coerceNumericalValue(attr[nodeColorAttribute]);

          if (color < minNodeColor) minNodeColor = color;
          if (color > maxNodeColor) maxNodeColor = color;
        }

        const size = coerceNumericalValue(attr[nodeSizeAttribute]);

        if (size < minNodeSize) minNodeSize = size;
        if (size > maxNodeSize) maxNodeSize = size;
      });

      const nodePalette: Palette<string> | undefined =
        nodePaletteBuilder?.build();

      rendererSettings.labelRenderedSizeThreshold = Math.min(maxNodeSize, 6);

      const nodeSizeScale = createScale<number>(
        minNodeSize,
        maxNodeSize,
        visualVariables.node_size.range
      );

      const nodeColorScale = needToComputeNodeColorExtent
        ? createScale<string>(
            minNodeColor,
            maxNodeColor,
            (<ContinuousVisualVariable>visualVariables.node_color).range
          )
        : null;

      // Edges
      const edgeColorAttribute =
        (<any>visualVariables.edge_color).attribute || 'color';
      const edgeColorFrom =
        visualVariables.edge_color.type === 'dependent'
          ? visualVariables.edge_color.value
          : null;

      const edgePaletteBuilder: PaletteBuilder<string> | null =
        visualVariables.edge_color.type === 'category'
          ? new PaletteBuilder(edgeColorAttribute, CATEGORY_MAX_COUNT, {
              defaultColor: rendererSettings.defaultEdgeColor,
            })
          : null;

      const edgeSizeAttribute =
        visualVariables.edge_size.type === 'continuous'
          ? visualVariables.edge_size.attribute
          : 'size';

      const needToComputeEdgeColorExtent =
        visualVariables.edge_color.type === 'continuous';

      let minEdgeSize = Infinity;
      let maxEdgeSize = -Infinity;
      let minEdgeColor = Infinity;
      let maxEdgeColor = -Infinity;

      const edgeLabelAttribute = visualVariables.edge_label?.attribute;

      if (edgeLabelAttribute) {
        rendererSettings.renderEdgeLabels = true;
      }

      graph.forEachEdge((edge, attr) => {
        if (edgePaletteBuilder) {
          edgePaletteBuilder.add(attr[edgeColorAttribute]);
        } else if (needToComputeEdgeColorExtent) {
          const color = coerceNumericalValue(attr[edgeColorAttribute]);

          if (color < minEdgeColor) minEdgeColor = color;
          if (color > maxEdgeColor) maxEdgeColor = color;
        }

        const size = coerceNumericalValue(attr[edgeSizeAttribute]);

        if (size < minEdgeSize) minEdgeSize = size;
        if (size > maxEdgeSize) maxEdgeSize = size;
      });

      const edgePalette: Palette<string> | undefined =
        edgePaletteBuilder?.build();

      const edgeSizeScale = createScale<number>(
        minEdgeSize,
        maxEdgeSize,
        visualVariables.edge_size.range
      );

      const edgeColorScale = needToComputeEdgeColorExtent
        ? createScale<string>(
            minEdgeColor,
            maxEdgeColor,
            (<ContinuousVisualVariable>visualVariables.edge_color).range
          )
        : null;

      this.updateLegend(
        visualVariables,
        {
          nodeColor: nodePalette,
          edgeColor: edgePalette,
        },
        rendererSettings
      );

      // Node reducer
      rendererSettings.nodeReducer = (node, data) => {
        const displayData: Partial<CustomNodeDisplayData> = {
          x: data.x,
          y: data.y,
        };

        // Visual variables
        const colorValue = data[nodeColorAttribute];
        displayData.categoryValue = colorValue;

        if (nodePalette) {
          displayData.color = nodePalette.get(colorValue);
        } else if (nodeColorScale) {
          displayData.color = nodeColorScale(colorValue);
        } else {
          displayData.color = colorValue;
        }

        if (nodeSizeScale) {
          displayData.size = nodeSizeScale(
            coerceNumericalValue(data[nodeSizeAttribute])
          );
        }

        displayData.label = data[nodeLabelAttribute] || node;

        // Transient state
        if (node === this.selectedNode) {
          displayData.highlighted = true;
        }

        if (
          (this.focusedNodes && !this.focusedNodes.has(node)) ||
          (this.selectedNodeCategories &&
            !this.selectedNodeCategories.has(colorValue))
        ) {
          displayData.color = MUTED_NODE_COLOR;
          displayData.zIndex = 0;
          displayData.size = displayData.size ? displayData.size / 2 : 1;
          displayData.hoverLabel = displayData.label;
          displayData.label = '';
        } else {
          displayData.zIndex = 1;
        }

        nodeDisplayDataRegister[node] = displayData;

        return displayData;
      };

      // Edge reducer
      rendererSettings.edgeReducer = (edge, data) => {
        const displayData: Partial<EdgeDisplayData> = {};

        const [source, target] = graph.extremities(edge);

        // Visual variables
        const colorValue = data[edgeColorAttribute];

        if (edgePalette) {
          displayData.color = edgePalette.get(colorValue);
        } else if (edgeColorScale) {
          displayData.color = edgeColorScale(colorValue);
        } else if (edgeColorFrom) {
          displayData.color =
            nodeDisplayDataRegister[
              edgeColorFrom === 'source' ? source : target
            ]?.color || rendererSettings.defaultNodeColor;
        } else {
          displayData.color = colorValue;
        }

        if (edgeSizeScale) {
          displayData.size = edgeSizeScale(
            coerceNumericalValue(data[edgeSizeAttribute])
          );
        }

        if (edgeLabelAttribute) {
          displayData.label = data[edgeLabelAttribute] || edge;
        }

        // Transient state
        if (this.selectedNode && this.focusedNodes) {
          if (source !== this.selectedNode && target !== this.selectedNode) {
            displayData.hidden = true;
          }
        }

        if (this.selectedNodeCategories) {
          if (
            !this.selectedNodeCategories.has(
              nodeDisplayDataRegister[source]?.categoryValue as string
            ) &&
            !this.selectedNodeCategories.has(
              nodeDisplayDataRegister[target]?.categoryValue as string
            )
          ) {
            displayData.hidden = true;
          }
        }

        if (this.selectedEdgeCategories) {
          if (!this.selectedEdgeCategories.has(colorValue)) {
            displayData.hidden = true;
          }
        }

        if (this.selectedEdge) {
          displayData.hidden = edge !== this.selectedEdge;
        }

        return displayData;
      };

      this.renderer = new Sigma(graph, this.container, rendererSettings);

      const initialCameraState = this.model.get('camera_state') as CameraState;
      this.renderer.getCamera().setState(initialCameraState);

      const selectedNode = this.model.get('selected_node') as
        | string
        | undefined;
      const selectedEdge = this.model.get('selected_edge') as
        | string
        | undefined;

      if (selectedNode) this.selectItem('node', selectedNode);
      else if (selectedEdge)
        this.selectItem(
          'edge',
          graph.edge(selectedEdge[0], selectedEdge[1]) as string
        );
      else this.clearSelectedItem();

      this.bindMessageHandlers();
      this.bindRendererHandlers();
      this.bindChoicesHandlers();
      this.bindInformationDisplayHandlers();
      this.bindDownloadHandlers();
      this.bindCameraHandlers();
      this.bindFullscreenHandlers();
      this.bindLayoutHandlers();
    });
  }

  renderSnapshot() {
    this.model.set('snapshot', renderAsDataURL(this.renderer));
    this.touch();
  }

  saveCameraState(state: CameraState) {
    this.model.set('camera_state', state);
    this.touch();
  }

  saveLayout() {
    const mapping = collectLayout(this.graph);
    this.model.set('layout', mapping);
    this.touch();
  }

  resetLayout() {
    this.model.set('layout', this.originalLayoutPositions);
    this.touch();
  }

  changeInformationDisplayTab(tab: InformationDisplayTab) {
    if (tab === 'legend') {
      hide(this.infoElement);
      show(this.legendElement);
      this.legendButton.classList.remove('selectable');
      this.nodeInfoButton.classList.add('selectable');
    } else {
      hide(this.legendElement);
      show(this.infoElement);
      this.legendButton.classList.add('selectable');
      this.nodeInfoButton.classList.remove('selectable');
    }
  }

  updateLegend(
    variables: VisualVariables,
    palettes: { nodeColor?: Palette<string>; edgeColor?: Palette<string> },
    rendererSettings: Partial<SigmaSettings>
  ) {
    type ItemType = 'node' | 'edge';

    const categoryMap: Map<number, { type: ItemType; values: Array<string> }> =
      new Map();
    let dataId = 0;

    function renderLegend(
      type: ItemType,
      title: string,
      variable: VisualVariable,
      palette?: Palette<string>,
      defaultColor?: string
    ) {
      let html = `<b>${title}</b><br>`;

      if (variable.type === 'dependent') {
        html += `based on <span class="ipysigma-keyword">${variable.value}</span> color`;
      } else {
        const source = variable.attribute.startsWith('$$')
          ? 'kwarg'
          : 'attribute';
        const name = variable.attribute.startsWith('$$')
          ? variable.attribute.slice(2)
          : variable.attribute;

        if (variable.type === 'raw') {
          html += `<span class="ipysigma-keyword">${escapeHtml(
            name
          )}</span> ${source}`;
        } else if (variable.type === 'continuous') {
          html += `<span class="ipysigma-keyword">${escapeHtml(
            name
          )}</span> ${source} `;

          if (typeof variable.range[0] === 'number') {
            html += `(scaled to <span class="ipysigma-number">${variable.range[0]}</span>-<span class="ipysigma-number">${variable.range[1]}</span> px)`;
          } else {
            html += `(from <span style="color: ${variable.range[0]}">■</span> ${variable.range[0]} to <span style="color: ${variable.range[1]}">■</span> ${variable.range[1]})`;
          }
        } else if (variable.type === 'category') {
          html += `<span class="ipysigma-keyword">${escapeHtml(
            name
          )}</span> ${source} as a category:`;

          const paletteItems: string[] = [];

          if (palette) {
            const values: string[] = [];
            categoryMap.set(dataId, { type, values });
            let i = 0;

            palette.forEach((color, value) => {
              values.push(value);
              paletteItems.push(
                `<span title="click to filter" class="category" data-key="${dataId}" data-index="${i++}"><span style="color: ${color}">■</span> <span class="category-value">${value}</span></span>`
              );
            });

            dataId++;

            if (palette.overflowing) {
              paletteItems.push(
                `<span style="color: ${palette.defaultColor}">■</span> ...`
              );
            }
          } else {
            paletteItems.push(
              `<span style="color: ${defaultColor}">■</span> default`
            );
          }

          html += '<br>' + paletteItems.join('<br>');
        }
      }

      return html;
    }

    const items = [
      renderLegend('node', 'Node labels', variables.node_label),
      renderLegend(
        'node',
        'Node colors',
        variables.node_color,
        palettes.nodeColor,
        rendererSettings.defaultNodeColor
      ),
      renderLegend('node', 'Node sizes', variables.node_size),
      renderLegend(
        'edge',
        'Edge colors',
        variables.edge_color,
        palettes.edgeColor,
        rendererSettings.defaultEdgeColor
      ),
      renderLegend('edge', 'Edge sizes', variables.edge_size),
    ];

    if (variables.edge_label) {
      items.push(renderLegend('edge', 'Edge labels', variables.edge_label));
    }

    this.legendElement.innerHTML = items.join('<hr>');

    // Binding category span events
    function getSpanInfo(span: HTMLElement): { type: ItemType; value: string } {
      const key = +(span.getAttribute('data-key') as string);
      const index = +(span.getAttribute('data-index') as string);

      const record = categoryMap.get(key);

      if (!record)
        throw new Error('error registering category span click event handlers');

      return { type: record.type, value: record.values[index] };
    }

    const categorySpans = this.legendElement.querySelectorAll(
      '.category'
    ) as NodeListOf<HTMLElement>;

    const updateSpans = () => {
      categorySpans.forEach((span) => {
        const { type, value } = getSpanInfo(span);

        if (type === 'node') {
          if (
            !this.selectedNodeCategories ||
            this.selectedNodeCategories.has(value)
          ) {
            span.classList.remove('evicted');
          } else {
            span.classList.add('evicted');
          }
        } else if (type === 'edge') {
          if (
            !this.selectedEdgeCategories ||
            this.selectedEdgeCategories.has(value)
          ) {
            span.classList.remove('evicted');
          } else {
            span.classList.add('evicted');
          }
        }
      });
    };

    categorySpans.forEach((span) => {
      span.onclick = () => {
        const { type, value } = getSpanInfo(span);

        this.toggleCategoryValue(type, value);
        updateSpans();
        this.renderer.refresh();
      };
    });
  }

  clearSelectedItem() {
    this.selectedEdge = null;
    this.selectedNode = null;
    this.focusedNodes = null;

    this.choices.setChoiceByValue('');

    if (this.model.get('clickable_edges')) {
      this.infoElement.innerHTML =
        '<i>Click on a node/edge or search a node to display information about it...</i>';
    } else {
      this.infoElement.innerHTML =
        '<i>Click on a node or search a node to display information about it...</i>';
    }

    this.changeInformationDisplayTab('legend');

    this.model.set('selected_node', null);
    this.model.set('selected_edge', null);
    this.touch();

    this.renderer.refresh();
  }

  toggleCategoryValue(type: ItemType, value: string) {
    let target =
      type === 'node'
        ? this.selectedNodeCategories
        : this.selectedEdgeCategories;

    if (!target) {
      target = new Set([value]);
    } else if (target.has(value)) {
      if (target.size === 1) {
        target = null;
      } else {
        target.delete(value);
      }
    } else {
      target.add(value);
    }

    if (type === 'node') this.selectedNodeCategories = target;
    else this.selectedEdgeCategories = target;
  }

  selectItem(type: ItemType, key: string) {
    const graph = this.graph;

    if (type === 'node') {
      this.selectedEdge = null;
      this.selectedNode = key;
      const focusedNodes: Set<string> = new Set();

      focusedNodes.add(this.selectedNode);

      graph.forEachNeighbor(key, (neighbor) => {
        focusedNodes.add(neighbor);
      });

      this.focusedNodes = focusedNodes;
      this.choices.setChoiceByValue(key);
      this.model.set('selected_node', key);
      this.model.set('selected_edge', null);
    } else {
      const extremities = graph.extremities(key);
      this.selectedEdge = key;
      this.selectedNode = null;
      this.focusedNodes = new Set(extremities);
      this.choices.setChoiceByValue('');
      this.model.set('selected_edge', extremities);
      this.model.set('selected_node', null);
    }

    this.touch();

    const attr =
      type === 'node'
        ? graph.getNodeAttributes(key)
        : graph.getEdgeAttributes(key);

    let innerHTML = '';

    if (type === 'node') {
      innerHTML += `<b>Node</b> <i>${renderTypedValue(key)}</i>`;
    } else {
      const [source, target] = this.graph.extremities(key);
      innerHTML += '<b>Edge</b>';

      if (!key.startsWith('geid_'))
        innerHTML += ` <i>${renderTypedValue(key)}</i>`;

      innerHTML += `<br>from ${renderTypedValue(source)} to ${renderTypedValue(
        target
      )}`;
    }

    const kwargInfo: string[] = [];
    const vizInfo: string[] = [];
    const info: string[] = [];

    const vizAttributes =
      type === 'node' ? NODE_VIZ_ATTRIBUTES : EDGE_VIZ_ATTRIBUTES;

    for (let k in attr) {
      let target = info;

      if (vizAttributes.has(k)) target = vizInfo;
      else if (k.startsWith('$$')) target = kwargInfo;

      target.push(
        `<b>${k.startsWith('$$') ? k.slice(2) : k}</b> ${renderTypedValue(
          attr[k]
        )}`
      );
    }

    if (kwargInfo.length !== 0)
      innerHTML += '<hr>From kwargs:<br>' + kwargInfo.join('<br>');
    if (info.length !== 0)
      innerHTML += `<hr>Attributes:<br>` + info.join('<br>');
    if (vizInfo.length !== 0)
      innerHTML += '<hr>Known viz data:<br>' + vizInfo.join('<br>');

    if (type === 'node') {
      innerHTML += '<hr>Computed metrics:<br>';
      innerHTML += `<b>degree</b> ${renderTypedValue(graph.degree(key))}<br>`;

      if (graph.directedSize !== 0) {
        innerHTML += `<b>indegree</b> ${renderTypedValue(
          graph.inDegree(key)
        )}<br>`;
        innerHTML += `<b>outdegree</b> ${renderTypedValue(
          graph.outDegree(key)
        )}<br>`;
      }
    }

    this.infoElement.innerHTML = innerHTML;

    this.changeInformationDisplayTab('info');

    this.renderer.refresh();
  }

  moveCameraToNode(node: string): void {
    const pos = this.renderer.getNodeDisplayData(node);

    if (!pos) return;

    this.renderer.getCamera().animate(pos, { duration: 500 });
  }

  bindMessageHandlers() {
    this.model.on('msg:custom', (content) => {
      if (content.msg === 'render_snapshot') {
        this.renderSnapshot();
      }
    });
  }

  bindRendererHandlers() {
    const debouncedSaveCameraState = debounce(
      this.saveCameraState.bind(this),
      500
    );

    this.renderer.getCamera().on('updated', (state) => {
      debouncedSaveCameraState(state);
    });

    this.renderer.on('enterNode', () => {
      this.container.style.cursor = 'pointer';
    });

    this.renderer.on('leaveNode', () => {
      this.container.style.cursor = 'default';
    });

    this.renderer.on('clickNode', ({ node }) => {
      if (node === this.selectedNode) return;

      this.selectItem('node', node);
    });

    this.renderer.on('clickStage', () => {
      if (!this.selectedNode && !this.selectedEdge) return;

      this.clearSelectedItem();
    });

    if (this.model.get('clickable_edges')) {
      this.renderer.on('enterEdge', () => {
        this.container.style.cursor = 'pointer';
      });

      this.renderer.on('leaveEdge', () => {
        this.container.style.cursor = 'default';
      });

      this.renderer.on('clickEdge', ({ edge }) => {
        if (edge === this.selectedEdge) return;

        this.selectItem('edge', edge);
      });
    }
  }

  bindChoicesHandlers() {
    this.choices.passedElement.element.addEventListener(
      'change',
      (event: any) => {
        const node = event.detail.value;

        if (node === this.selectedNode) return;

        if (!node) return this.clearSelectedItem();

        this.selectItem('node', node);

        // We don't need to move the camera if we are fully unzoomed
        if (this.renderer.getCamera().getState().ratio >= 1) return;
        this.moveCameraToNode(node);
      }
    );
  }

  bindInformationDisplayHandlers() {
    this.legendButton.onclick = () => {
      if (!this.legendButton.classList.contains('selectable')) return;

      this.changeInformationDisplayTab('legend');
    };

    this.nodeInfoButton.onclick = () => {
      if (!this.nodeInfoButton.classList.contains('selectable')) return;

      this.changeInformationDisplayTab('info');
    };
  }

  bindDownloadHandlers() {
    this.downloadPNGButton.onclick = () => {
      saveAsPNG(this.renderer);
    };
    this.downloadGEXFButton.onclick = () => {
      saveAsGEXF(this.renderer);
    };
    this.downloadSVGButton.onclick = () => {
      saveAsSVG(this.renderer);
    };
    this.downloadJSONButton.onclick = () => {
      saveAsJSON(this.renderer);
    };
  }

  bindCameraHandlers() {
    this.zoomButton.onclick = () => {
      this.renderer.getCamera().animatedZoom();
    };

    this.unzoomButton.onclick = () => {
      this.renderer.getCamera().animatedUnzoom();
    };

    this.resetZoomButton.onclick = () => {
      this.renderer
        .getCamera()
        .animate({ ratio: 1, x: CAMERA_OFFSET, y: 0.5, angle: 0 });
    };
  }

  bindFullscreenHandlers() {
    this.fullscreenButton.onclick = () => {
      if (screenfull.isFullscreen) {
        screenfull.exit();
        this.container.style.height = this.model.get('height') + 'px';
        this.fullscreenButton.innerHTML = fullscreenEnterIcon;
        this.fullscreenButton.setAttribute('title', 'enter fullscreen');
      } else {
        screenfull.request(this.el);
        this.container.style.height = '100%';
        this.fullscreenButton.innerHTML = fullscreenExitIcon;
        this.fullscreenButton.setAttribute('title', 'exit fullscreen');
      }
    };
  }

  bindLayoutHandlers() {
    const graph = this.graph;
    const renderer = this.renderer;

    const settings = this.model.get('layout_settings') as
      | ForceAtlas2Settings
      | undefined;

    this.layout = new LayoutSupervisor(graph, {
      settings: settings ? settings : forceAtlas2.inferSettings(graph),
    });

    this.noverlap = new NoverlapSupervisor(graph, {
      inputReducer(key, attr) {
        const pos = renderer.graphToViewport(attr);

        return {
          x: pos.x,
          y: pos.y,
          size: renderer.getNodeDisplayData(key)?.size,
        };
      },
      outputReducer(key, attr) {
        return renderer.viewportToGraph(attr);
      },
      onConverged() {
        stopNoverlap(true);
      },
      settings: { ratio: 1, margin: 3 },
    });

    hide(this.resetLayoutButton);

    const stopLayout = () => {
      if (this.layoutSpinner) {
        this.layoutControls.removeChild(this.layoutSpinner[0]);
        this.layoutSpinner[1]();
        this.layoutSpinner = null;
      }
      this.layoutButton.innerHTML = playIcon;
      this.layoutButton.setAttribute('title', 'start layout');
      this.layout.stop();
      this.saveLayout();
      enable(this.noverlapButton);
      show(this.resetLayoutButton);
    };

    const startLayout = () => {
      this.layoutSpinner = createSpinner();
      this.layoutButton.innerHTML = pauseIcon;
      this.layoutControls.appendChild(this.layoutSpinner[0]);
      this.layoutButton.setAttribute('title', 'stop layout');
      this.layout.start();
      disable(this.noverlapButton);
      hide(this.resetLayoutButton);
    };

    const stopNoverlap = (disableButton: boolean = false) => {
      if (this.layoutSpinner) {
        this.layoutControls.removeChild(this.layoutSpinner[0]);
        this.layoutSpinner[1]();
        this.layoutSpinner = null;
      }
      this.noverlapButton.innerHTML = scatterIcon;
      this.noverlapButton.setAttribute('title', 'spread nodes');
      this.noverlap.stop();
      this.saveLayout();
      enable(this.layoutButton);
      show(this.resetLayoutButton);

      if (disableButton) disable(this.noverlapButton);
    };

    const startNoverlap = () => {
      this.layoutSpinner = createSpinner();
      this.noverlapButton.innerHTML = pauseIcon;
      this.layoutControls.appendChild(this.layoutSpinner[0]);
      this.noverlapButton.setAttribute('title', 'stop');
      this.noverlap.start();
      disable(this.layoutButton);
      hide(this.resetLayoutButton);
    };

    const resetLayout = () => {
      enable(this.noverlapButton);
      hide(this.resetLayoutButton);
      this.resetLayout();
      animateNodes(graph, this.originalLayoutPositions, { duration: 250 });
    };

    if (this.model.get('start_layout')) startLayout();

    this.layoutButton.onclick = () => {
      if (this.layout.isRunning()) {
        stopLayout();
      } else {
        startLayout();
      }
    };

    this.noverlapButton.onclick = () => {
      if (this.noverlap.isRunning()) {
        stopNoverlap();
      } else {
        startNoverlap();
      }
    };

    this.resetLayoutButton.onclick = () => {
      resetLayout();
    };
  }

  remove() {
    // Cleanup to avoid leaks and free GPU slots
    if (this.renderer) this.renderer.kill();

    if (this.singleton) {
      this.model.set('singleton_lock', false);
      this.touch();
    }

    super.remove();
  }
}
