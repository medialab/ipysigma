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
import Sigma from 'sigma';
import { animateNodes } from 'sigma/utils/animate';
import { Settings as SigmaSettings } from 'sigma/settings';
import { CameraState } from 'sigma/types';
import seedrandom from 'seedrandom';
import type { Properties as CSSProperties } from 'csstype';
import comma from 'comma-number';
import Choices from 'choices.js';
import screenfull from 'screenfull';
import MultiSet from 'mnemonist/multi-set';
import { scaleLinear, ScaleLinear } from 'd3-scale';
import debounce from 'debounce';

import { MODULE_NAME, MODULE_VERSION } from './version';
import drawHover from './custom-hover';
import {
  renderAsDataURL,
  saveAsPNG,
  saveAsGEXF,
  saveAsJSON,
  saveAsSVG,
  generatePalette,
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
const DEFAULT_CONSTANT_NODE_SIZE = 5;
const DEFAULT_CONSTANT_EDGE_SIZE = 0.5;
const PALETTE_OVERFLOW = Symbol();

/**
 * Types.
 */
type ItemType = 'node' | 'edge';
type RNGFunction = () => number;
type InformationDisplayTab = 'legend' | 'info';
type Position = { x: number; y: number };
type LayoutMapping = Record<string, Position>;
type Range = [number, number];
type Palette = {
  [value: string]: string;
  [PALETTE_OVERFLOW]: boolean;
};

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

type VisualVariable =
  | RawVisualVariable
  | CategoryVisualVariable
  | ContinuousVisualVariable;

type VisualVariables = {
  node_color: VisualVariable;
  node_size: VisualVariable;
  node_label: RawVisualVariable;
  edge_color: VisualVariable;
  edge_size: VisualVariable;
  edge_label: VisualVariable | null;
};

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

    const preexistingLayout = this.model.get('layout');

    if (preexistingLayout) {
      applyLayout(graph, preexistingLayout);
    } else {
      this.saveLayout();
    }
    this.originalLayoutPositions = collectLayout(graph);

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
      };

      // Gathering info about the graph to build reducers correctly
      const visualVariables = this.model.get(
        'visual_variables'
      ) as VisualVariables;

      // Nodes
      let nodeColorPalette: Palette | null = null;
      let nodeColorCategory =
        visualVariables.node_color.type === 'category'
          ? visualVariables.node_color.attribute
          : null;

      const nodeCategoryFrequencies = new MultiSet<string>();

      let nodeSizeAttribute =
        visualVariables.node_size.type === 'continuous'
          ? visualVariables.node_size.attribute
          : 'size';

      let minNodeSize = Infinity;
      let maxNodeSize = -Infinity;

      let nodeLabelAttribute = visualVariables.node_label.attribute;

      graph.forEachNode((node, attr) => {
        if (nodeColorCategory) {
          nodeCategoryFrequencies.add(attr[nodeColorCategory]);
        }

        const size = attr[nodeSizeAttribute];

        if (typeof size === 'number') {
          if (size < minNodeSize) minNodeSize = size;
          if (size > maxNodeSize) maxNodeSize = size;
        }
      });

      if (nodeColorCategory) {
        const count = Math.min(
          nodeCategoryFrequencies.dimension,
          CATEGORY_MAX_COUNT
        );

        const colors = generatePalette(nodeColorCategory, count);

        nodeColorPalette = {
          [PALETTE_OVERFLOW]: count < nodeCategoryFrequencies.dimension,
        };

        nodeCategoryFrequencies.top(count).forEach(([value], i) => {
          (<Palette>nodeColorPalette)[value] = colors[i];
        });
      }

      const hasConstantNodeSizes =
        minNodeSize === Infinity || minNodeSize === maxNodeSize;

      rendererSettings.labelRenderedSizeThreshold = hasConstantNodeSizes
        ? DEFAULT_CONSTANT_NODE_SIZE
        : Math.min(maxNodeSize, 6);

      let nodeSizeScale: ScaleLinear<number, number> | null = null;

      if (
        !hasConstantNodeSizes &&
        visualVariables.node_size.type === 'continuous'
      ) {
        nodeSizeScale = scaleLinear()
          .domain([minNodeSize, maxNodeSize])
          .range(visualVariables.node_size.range);
      }

      // Edges
      let edgeColorPalette: Palette | null = null;
      let edgeColorCategory =
        visualVariables.edge_color.type === 'category'
          ? visualVariables.edge_color.attribute
          : null;

      const edgeCategoryFrequencies = new MultiSet<string>();

      let edgeSizeAttribute =
        visualVariables.edge_size.type === 'continuous'
          ? visualVariables.edge_size.attribute
          : 'size';

      let minEdgeSize = Infinity;
      let maxEdgeSize = -Infinity;

      let edgeLabelAttribute = visualVariables.edge_label?.attribute;

      if (edgeLabelAttribute) {
        rendererSettings.renderEdgeLabels = true;
      }

      graph.forEachEdge((edge, attr) => {
        if (edgeColorCategory) {
          edgeCategoryFrequencies.add(attr[edgeColorCategory]);
        }

        const size = attr[edgeSizeAttribute];

        if (typeof size === 'number') {
          if (size < minEdgeSize) minEdgeSize = size;
          if (size > maxEdgeSize) maxEdgeSize = size;
        }
      });

      if (edgeColorCategory) {
        const count = Math.min(
          edgeCategoryFrequencies.dimension,
          CATEGORY_MAX_COUNT
        );

        const colors = generatePalette(edgeColorCategory, count);

        edgeColorPalette = {
          [PALETTE_OVERFLOW]: count < edgeCategoryFrequencies.dimension,
        };

        edgeCategoryFrequencies.top(count).forEach(([value], i) => {
          (<Palette>edgeColorPalette)[value] = colors[i];
        });
      }

      const hasConstantEdgeSizes =
        minEdgeSize === Infinity || minEdgeSize === maxEdgeSize;

      rendererSettings.labelRenderedSizeThreshold = hasConstantEdgeSizes
        ? DEFAULT_CONSTANT_EDGE_SIZE
        : Math.min(maxEdgeSize, 6);

      let edgeSizeScale: ScaleLinear<number, number> | null = null;

      if (
        !hasConstantEdgeSizes &&
        visualVariables.edge_size.type === 'continuous'
      ) {
        edgeSizeScale = scaleLinear()
          .domain([minEdgeSize, maxEdgeSize])
          .range(visualVariables.edge_size.range);
      }

      this.updateLegend(visualVariables, {
        nodeColor: nodeColorPalette,
        edgeColor: edgeColorPalette,
      });

      // Node reducer
      rendererSettings.nodeReducer = (node, data) => {
        const displayData = { ...data };

        // Visual variables
        if (nodeColorCategory && nodeColorPalette) {
          displayData.color =
            nodeColorPalette[data[nodeColorCategory]] || '#999';
        }

        if (hasConstantNodeSizes) {
          displayData.size = DEFAULT_CONSTANT_NODE_SIZE;
        } else if (nodeSizeScale) {
          displayData.size = nodeSizeScale(data[nodeSizeAttribute] || 1);
        }

        displayData.label = data[nodeLabelAttribute] || node;

        // Transient state
        if (node === this.selectedNode) {
          displayData.highlighted = true;
        }

        if (this.focusedNodes && !this.focusedNodes.has(node)) {
          displayData.color = 'lightgray';
          displayData.zIndex = 0;
          displayData.size = displayData.size ? displayData.size / 2 : 1;
          displayData.hoverLabel = displayData.label;
          displayData.label = '';
        } else {
          displayData.zIndex = 1;
        }

        return displayData;
      };

      // Edge reducer
      rendererSettings.edgeReducer = (edge, data) => {
        const displayData = { ...data };

        // Visual variables
        if (edgeColorCategory && edgeColorPalette) {
          displayData.color =
            edgeColorPalette[data[edgeColorCategory]] || '#ccc';
        }

        if (hasConstantEdgeSizes) {
          displayData.size = DEFAULT_CONSTANT_EDGE_SIZE;
        } else if (edgeSizeScale) {
          displayData.size = edgeSizeScale(data[edgeSizeAttribute] || 1);
        }

        if (edgeLabelAttribute) {
          displayData.label = data[edgeLabelAttribute] || edge;
        }

        // Transient state
        if (this.selectedNode && this.focusedNodes) {
          const [source, target] = graph.extremities(edge);

          if (source !== this.selectedNode && target !== this.selectedNode) {
            displayData.hidden = true;
          }
        } else if (this.selectedEdge) {
          displayData.hidden = edge !== this.selectedEdge;
        }

        return displayData;
      };

      this.renderer = new Sigma(graph, this.container, rendererSettings);

      const initialCameraState = this.model.get('camera_state') as CameraState;
      this.renderer.getCamera().setState(initialCameraState);

      this.clearSelectedItem();

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
    palettes: { nodeColor: Palette | null; edgeColor: Palette | null }
  ) {
    function renderLegend(
      title: string,
      variable: VisualVariable,
      palette?: Palette | null
    ) {
      let html = `<b>${title}</b><br>`;

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
        )}</span> ${source} (scaled to <span class="ipysigma-number">${
          variable.range[0]
        }</span>-<span class="ipysigma-number">${variable.range[1]}</span> px)`;
      } else if (variable.type === 'category') {
        html += `<span class="ipysigma-keyword">${escapeHtml(
          name
        )}</span> ${source} as a category:`;

        const paletteItems: string[] = [];

        if (palette) {
          for (const k in palette) {
            paletteItems.push(
              `<span style="color: ${palette[k]}">■</span> ${k}`
            );
          }

          if (palette[PALETTE_OVERFLOW]) {
            paletteItems.push('<span style="color: #999">■</span> ...');
          }
        } else {
          paletteItems.push('<span style="color: #999">■</span> default');
        }

        html += '<br>' + paletteItems.join('<br>');
      }

      return html;
    }

    const items = [
      renderLegend('Node labels', variables.node_label),
      renderLegend('Node colors', variables.node_color, palettes.nodeColor),
      renderLegend('Node sizes', variables.node_size),
      renderLegend('Edge colors', variables.edge_color, palettes.edgeColor),
      renderLegend('Edge sizes', variables.edge_size),
    ];

    if (variables.edge_label) {
      items.push(renderLegend('Edge labels', variables.edge_label));
    }

    this.legendElement.innerHTML = items.join('<hr>');
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

    this.renderer.refresh();
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
    } else {
      this.selectedEdge = key;
      this.selectedNode = null;
      this.focusedNodes = new Set(this.graph.extremities(key));
      this.choices.setChoiceByValue('');
    }

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

    this.layout = new LayoutSupervisor(graph, {
      settings: forceAtlas2.inferSettings(graph),
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
