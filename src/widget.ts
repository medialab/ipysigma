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
import { collectLayout, assignLayout } from 'graphology-layout/utils';

import Sigma from 'sigma';
import { animateNodes } from 'sigma/utils/animate';
import {
  Settings as SigmaSettings,
  DEFAULT_SETTINGS as DEFAULT_SIGMA_SETTINGS,
} from 'sigma/settings';
import { CameraState, NodeDisplayData, EdgeDisplayData } from 'sigma/types';
import EdgeFastProgram from 'sigma/rendering/webgl/programs/edge.fast';
import EdgeTriangleProgram from 'sigma/rendering/webgl/programs/edge.triangle';
import createNodeBorderProgram from '@yomguithereal/sigma-experiments-renderers/node/border';

import EventEmitter from 'events';
import seedrandom from 'seedrandom';
import type { Properties as CSSProperties } from 'csstype';
import comma from 'comma-number';
import Choices from 'choices.js';
import screenfull from 'screenfull';
import debounce from 'debounce';

import { MODULE_NAME, MODULE_VERSION } from './version';
import drawHover from './custom-hover';
import {
  CategorySummary,
  VisualVariableScalesBuilder,
  VisualVariable,
  VisualVariables,
} from './visual-variables';
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
const NODE_VIZ_ATTRIBUTES = new Set(['label', 'size', 'color', 'x', 'y']);
const EDGE_VIZ_ATTRIBUTES = new Set(['label', 'size', 'color']);
const MUTED_NODE_COLOR = '#ccc';

/**
 * Types.
 */
type ItemType = 'node' | 'edge';
type RNGFunction = () => number;
type InformationDisplayTab = 'legend' | 'info';
type Position = { x: number; y: number };
type LayoutMapping = Record<string, Position>;

interface IPysigmaNodeDisplayData extends NodeDisplayData {
  hoverLabel?: string | null;
  categoryValue?: string;
  borderColor?: string;
}

type IPysigmaProgramSettings = {
  nodeBorderRatio: number;
};

/**
 * Template.
 */
const TEMPLATE = `
<div class="ipysigma-container"></div>
<div class="ipysigma-left-panel">
  <div class="ipysigma-graph-description"></div>
  <div>
    <button class="ipysigma-zoom-button ipysigma-button ipysigma-svg-icon" title="zoom">
      ${zoomIcon}
    </button>
    <button class="ipysigma-unzoom-button ipysigma-button ipysigma-svg-icon" title="unzoom">
      ${unzoomIcon}
    </button>
    <button class="ipysigma-reset-zoom-button ipysigma-button ipysigma-svg-icon" title="reset zoom">
      ${resetZoomIcon}
    </button>
  </div>
  <div>
    <button class="ipysigma-fullscreen-button ipysigma-button ipysigma-svg-icon" title="enter fullscreen">
      ${fullscreenEnterIcon}
    </button>
  </div>
  <div class="ipysigma-layout-controls">
    <button class="ipysigma-layout-button ipysigma-button ipysigma-svg-icon" title="start layout">
      ${playIcon}
    </button>
    <button class="ipysigma-noverlap-button ipysigma-button ipysigma-svg-icon" title="spread nodes">
      ${scatterIcon}
    </button>
    <button class="ipysigma-reset-layout-button ipysigma-button ipysigma-svg-icon" title="reset layout">
      ${resetLayoutIcon}
    </button>
  </div>
</div>
<div class="ipysigma-right-panel">
  <select class="ipysigma-search">
    <option value="">Search a node...</option>
  </select>
  <div class="ipysigma-information-shadow-display" style="display: none;">
    <span class="ipysigma-information-show-button">show legend</span>
  </div>
  <div class="ipysigma-information-display">
    <div class="ipysigma-information-display-tabs">
      <span class="ipysigma-information-legend-button ipysigma-tab-button">legend</span>
      &middot;
      <span class="ipysigma-information-info-button ipysigma-tab-button">info</span>
      <span class="ipysigma-information-hide-button">hide</span>
    </div>
    <hr>
    <div class="ipysigma-legend"></div>
    <div class="ipysigma-information-contents"></div>
  </div>
  <div class="ipysigma-download-controls">
    <button class="ipysigma-download-png-button ipysigma-button">
      png
    </button>
    <button class="ipysigma-download-svg-button ipysigma-button">
      svg
    </button>
    <button class="ipysigma-download-gexf-button ipysigma-button">
      gexf
    </button>
    <button class="ipysigma-download-json-button ipysigma-button">
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
function createRng(): RNGFunction {
  return seedrandom('ipysigma');
}

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
 * Global.
 */
type SyncRegistryEntry = {
  emitter: EventEmitter;
  renderers: Set<Sigma>;
};

const SYNC_REGISTRY: Map<string, SyncRegistryEntry> = new Map();

/**
 * View declaration.
 */
export class SigmaView extends DOMWidgetView {
  container: HTMLElement;
  renderer: Sigma;
  graph: Graph;
  emitter: EventEmitter = new EventEmitter();
  edgeWeightAttribute: string | null = null;

  syncKey: string | undefined;
  syncHoveredNode: string | null = null;
  syncListeners: Record<string, (...args: any) => void> = {};

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
  informationDisplayElement: HTMLElement;
  informationShadowDisplayElement: HTMLElement;
  itemInfoElement: HTMLElement;
  legendElement: HTMLElement;
  legendButton: HTMLElement;
  nodeInfoButton: HTMLElement;
  hideInformationButton: HTMLElement;
  showInformationButton: HTMLElement;
  isInformationShown: boolean = true;
  selectedNode: string | null = null;
  selectedEdge: string | null = null;
  focusedNodes: Set<string> | null = null;
  selectedNodeCategoryValues: Set<string> | null = null;
  selectedEdgeCategoryValues: Set<string> | null = null;

  downloadPNGButton: HTMLElement;
  downloadGEXFButton: HTMLElement;
  downloadSVGButton: HTMLElement;
  downloadJSONButton: HTMLElement;

  render() {
    super.render();

    this.el.classList.add('ipysigma-widget');

    const height = this.model.get('height');
    const data = this.model.get('data');

    const graph = buildGraph(data, createRng());
    this.graph = graph;

    // Preexisting layout?
    const preexistingLayout = this.model.get('layout');

    if (preexistingLayout) {
      assignLayout(graph, preexistingLayout);
    } else {
      this.saveLayout();
    }
    this.originalLayoutPositions = collectLayout(graph);

    // Selection state
    const selectedNodeCategoryValues = this.model.get(
      'selected_node_category_values'
    ) as Array<string> | undefined;
    const selectedEdgeCategoryValues = this.model.get(
      'selected_edge_category_values'
    ) as Array<string> | undefined;

    if (selectedNodeCategoryValues)
      this.selectedNodeCategoryValues = new Set(selectedNodeCategoryValues);
    if (selectedEdgeCategoryValues)
      this.selectedEdgeCategoryValues = new Set(selectedEdgeCategoryValues);

    // Widget-side metrics
    this.edgeWeightAttribute = this.model.get('edge_weight') as string | null;

    let nodeMetrics =
      (this.model.get('node_metrics') as Record<string, any>) || {};

    // NOTE: for some untractable reason, I need a completly new deep object
    nodeMetrics = JSON.parse(JSON.stringify(nodeMetrics));

    for (const attrName in nodeMetrics) {
      const metricSpec = nodeMetrics[attrName];
      const metric = metricSpec.name;

      if (metric === 'louvain') {
        const communities = louvain(graph, {
          getEdgeWeight: this.edgeWeightAttribute,
          rng: createRng(),
          resolution: metricSpec.resolution || 1,
        });

        metricSpec.result = communities;

        graph.updateEachNodeAttributes(
          (node, attr) => {
            attr[attrName] = communities[node];
            return attr;
          },
          { attributes: [attrName] }
        );
      } else {
        throw new Error(`unkown metric "${metric}"` + metric);
      }
    }

    this.model.set('node_metrics', nodeMetrics);
    this.touch();

    this.el.insertAdjacentHTML('beforeend', TEMPLATE);
    this.el.style.width = '100%';
    this.el.style.height = height + 'px';

    this.container = this.el.querySelector(
      '.ipysigma-container'
    ) as HTMLElement;
    this.container.style.width = '100%';
    this.container.style.height = height + 'px';

    // Description
    const description = this.el.querySelector(
      '.ipysigma-graph-description'
    ) as HTMLElement;
    description.innerHTML = getGraphDescription(graph);

    // Camera controls
    this.zoomButton = this.el.querySelector(
      '.ipysigma-zoom-button'
    ) as HTMLElement;
    this.unzoomButton = this.el.querySelector(
      '.ipysigma-unzoom-button'
    ) as HTMLElement;
    this.resetZoomButton = this.el.querySelector(
      '.ipysigma-reset-zoom-button'
    ) as HTMLElement;

    // Fullscreen controls
    this.fullscreenButton = this.el.querySelector(
      '.ipysigma-fullscreen-button'
    ) as HTMLElement;

    // Layout controls
    this.layoutControls = this.el.querySelector(
      '.ipysigma-layout-controls'
    ) as HTMLElement;
    this.layoutButton = this.el.querySelector(
      '.ipysigma-layout-button'
    ) as HTMLButtonElement;
    this.noverlapButton = this.el.querySelector(
      '.ipysigma-noverlap-button'
    ) as HTMLButtonElement;
    this.resetLayoutButton = this.el.querySelector(
      '.ipysigma-reset-layout-button'
    ) as HTMLButtonElement;

    // Search
    var searchContainer = this.el.querySelector(
      '.ipysigma-search'
    ) as HTMLElement;

    const nodeLabelAttribute =
      this.model.get('visual_variables').nodeLabel.attribute;

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

    this.informationDisplayElement = this.el.querySelector(
      '.ipysigma-information-display'
    ) as HTMLElement;
    this.informationShadowDisplayElement = this.el.querySelector(
      '.ipysigma-information-shadow-display'
    ) as HTMLElement;
    this.itemInfoElement = this.el.querySelector(
      '.ipysigma-information-contents'
    ) as HTMLElement;
    this.legendElement = this.el.querySelector(
      '.ipysigma-legend'
    ) as HTMLElement;

    this.nodeInfoButton = this.el.querySelector(
      '.ipysigma-information-info-button'
    ) as HTMLElement;
    this.legendButton = this.el.querySelector(
      '.ipysigma-information-legend-button'
    ) as HTMLElement;
    this.hideInformationButton = this.el.querySelector(
      '.ipysigma-information-hide-button'
    ) as HTMLElement;
    this.showInformationButton = this.el.querySelector(
      '.ipysigma-information-show-button'
    ) as HTMLElement;

    this.changeInformationDisplayTab('legend');

    // Download controls
    this.downloadPNGButton = this.el.querySelector(
      '.ipysigma-download-png-button'
    ) as HTMLElement;
    this.downloadGEXFButton = this.el.querySelector(
      '.ipysigma-download-gexf-button'
    ) as HTMLElement;
    this.downloadSVGButton = this.el.querySelector(
      '.ipysigma-download-svg-button'
    ) as HTMLElement;
    this.downloadJSONButton = this.el.querySelector(
      '.ipysigma-download-json-button'
    ) as HTMLElement;

    // Waiting for widget to be mounted to register events
    this.displayed.then(() => {
      const clickableEdges: boolean = this.model.get('clickable_edges');
      const programSettings = this.model.get(
        'program_settings'
      ) as IPysigmaProgramSettings;

      const visualVariables = this.model.get(
        'visual_variables'
      ) as VisualVariables;

      const nodeBordersEnabled =
        visualVariables.nodeBorderColor.type !== 'disabled';

      const edgeProgramClasses = {
        ...DEFAULT_SIGMA_SETTINGS.edgeProgramClasses,
        slim: EdgeFastProgram,
        triangle: EdgeTriangleProgram,
      };

      const nodeProgramClasses = {
        ...DEFAULT_SIGMA_SETTINGS.nodeProgramClasses,
      };

      if (nodeBordersEnabled) {
        nodeProgramClasses.circle = createNodeBorderProgram({
          borderRatio: programSettings.nodeBorderRatio,
        });
      }

      let rendererSettings = this.model.get(
        'renderer_settings'
      ) as Partial<SigmaSettings>;

      rendererSettings = {
        zIndex: true,
        enableEdgeClickEvents: clickableEdges,
        enableEdgeHoverEvents: clickableEdges,
        hoverRenderer: drawHover,
        edgeProgramClasses,
        nodeProgramClasses,
        ...rendererSettings,
      };

      if (!rendererSettings.defaultEdgeType)
        rendererSettings.defaultEdgeType =
          graph.type !== 'undirected' ? 'arrow' : 'line';

      // Gathering info about the graph to build reducers correctly
      const maxCategoryColors = this.model.get('max_category_colors') as number;

      const scaleBuilder = new VisualVariableScalesBuilder(
        visualVariables,
        maxCategoryColors
      );

      scaleBuilder.readGraph(graph);

      if (!('labelRenderedSizeThreshold' in rendererSettings))
        rendererSettings.labelRenderedSizeThreshold =
          scaleBuilder.inferLabelRenderedSizeThreshold();

      const scales = scaleBuilder.build();

      this.updateLegend(visualVariables, {
        nodeColor: scales.nodeColor?.summary,
        nodeBorderColor: scales.nodeBorderColor?.summary,
        edgeColor: scales.edgeColor?.summary,
      });

      const nodeDisplayDataRegister: Record<
        string,
        Partial<IPysigmaNodeDisplayData>
      > = {};

      const nodeCategoryAttribute =
        visualVariables.nodeColor.type === 'category'
          ? visualVariables.nodeColor.attribute
          : null;

      const edgeCategoryAttribute =
        visualVariables.edgeColor.type === 'category'
          ? visualVariables.edgeColor.attribute
          : null;

      const edgeColorFrom =
        visualVariables.edgeColor.type === 'dependent'
          ? visualVariables.edgeColor.value
          : null;

      // Node reducer
      rendererSettings.nodeReducer = (node, data) => {
        const displayData: Partial<IPysigmaNodeDisplayData> = {
          x: data.x,
          y: data.y,
        };

        // Visual variables
        const categoryValue = nodeCategoryAttribute
          ? data[nodeCategoryAttribute]
          : null;

        if (categoryValue) {
          displayData.categoryValue = categoryValue;
        }

        displayData.color = scales.nodeColor(data) as string;
        displayData.size = scales.nodeSize(data) as number;
        displayData.label = (scales.nodeLabel(data) || node) as string;

        if (nodeBordersEnabled) {
          displayData.borderColor = scales.nodeBorderColor(data) as string;
        }

        // Transient state
        if (node === this.selectedNode || node === this.syncHoveredNode) {
          displayData.highlighted = true;
        }

        if (
          (this.focusedNodes && !this.focusedNodes.has(node)) ||
          (this.selectedNodeCategoryValues &&
            !this.selectedNodeCategoryValues.has(categoryValue))
        ) {
          displayData.color = MUTED_NODE_COLOR;
          displayData.zIndex = 0;
          displayData.size = displayData.size ? displayData.size / 2 : 1;
          displayData.hoverLabel = displayData.label;
          displayData.label = '';

          if (nodeBordersEnabled) {
            displayData.borderColor = MUTED_NODE_COLOR;
          }
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
        const categoryValue = edgeCategoryAttribute
          ? data[edgeCategoryAttribute]
          : null;

        if (edgeColorFrom) {
          displayData.color =
            nodeDisplayDataRegister[
              edgeColorFrom === 'source' ? source : target
            ].color;
        } else {
          displayData.color = scales.edgeColor(data) as string;
        }

        displayData.size = scales.edgeSize(data) as number;

        if (scales.edgeLabel)
          displayData.label = scales.edgeLabel(data) as string;

        // Transient state
        if (this.selectedNode && this.focusedNodes) {
          if (source !== this.selectedNode && target !== this.selectedNode) {
            displayData.hidden = true;
          }
        }

        if (this.selectedNodeCategoryValues) {
          if (
            !this.selectedNodeCategoryValues.has(
              nodeDisplayDataRegister[source]?.categoryValue as string
            ) &&
            !this.selectedNodeCategoryValues.has(
              nodeDisplayDataRegister[target]?.categoryValue as string
            )
          ) {
            displayData.hidden = true;
          }
        }

        if (this.selectedEdgeCategoryValues) {
          if (!this.selectedEdgeCategoryValues.has(categoryValue)) {
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

      this.syncKey = this.model.get('sync_key') as string | undefined;

      if (this.syncKey) {
        const currentSyncEntry = SYNC_REGISTRY.get(this.syncKey);

        if (!currentSyncEntry) {
          const emitter = new EventEmitter();

          SYNC_REGISTRY.set(this.syncKey, {
            emitter,
            renderers: new Set([this.renderer]),
          });

          this.bindSyncEvents(emitter);
        } else {
          currentSyncEntry.renderers.add(this.renderer);
          this.bindSyncEvents(currentSyncEntry.emitter);
        }
      }
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
      hide(this.itemInfoElement);
      show(this.legendElement);
      this.legendButton.classList.remove('selectable');
      this.nodeInfoButton.classList.add('selectable');
    } else {
      hide(this.legendElement);
      show(this.itemInfoElement);
      this.legendButton.classList.add('selectable');
      this.nodeInfoButton.classList.remove('selectable');
    }
  }

  toggleInformationDisplay(): void {
    if (this.isInformationShown) {
      // Hiding
      hide(this.informationDisplayElement);
      show(this.informationShadowDisplayElement);
      this.isInformationShown = false;
    } else {
      // Showing
      show(this.informationDisplayElement);
      hide(this.informationShadowDisplayElement);
      this.isInformationShown = true;
    }
  }

  updateLegend(
    variables: VisualVariables,
    summaries: {
      nodeColor?: CategorySummary;
      nodeBorderColor?: CategorySummary;
      edgeColor?: CategorySummary;
    }
  ) {
    type ItemType = 'node' | 'edge';

    const categoryMap: Map<number, { type: ItemType; values: Array<string> }> =
      new Map();
    let dataId = 0;

    function renderLegend(
      type: ItemType,
      title: string,
      variable: VisualVariable,
      summary?: CategorySummary,
      defaultColor?: string
    ) {
      if (variable.type === 'disabled') return null;

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
        } else {
          html += `<span class="ipysigma-keyword">${escapeHtml(
            name
          )}</span> ${source} as a category:`;

          const paletteItems: string[] = [];

          if (summary) {
            const values: string[] = [];
            categoryMap.set(dataId, { type, values });
            let i = 0;

            summary.palette.forEach((color, value) => {
              values.push(value);
              paletteItems.push(
                `<span title="click to filter" class="category" data-key="${dataId}" data-index="${i++}"><span style="color: ${color}">■</span> <span class="category-value">${value}</span></span>`
              );
            });

            dataId++;

            if (summary.overflowing) {
              paletteItems.push(
                `<span style="color: ${summary.palette.defaultColor}">■</span> ...`
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
      renderLegend('node', 'Node labels', variables.nodeLabel),
      renderLegend(
        'node',
        'Node colors',
        variables.nodeColor,
        summaries.nodeColor
      ),
      renderLegend(
        'node',
        'Node border colors',
        variables.nodeBorderColor,
        summaries.nodeBorderColor
      ),
      renderLegend('node', 'Node sizes', variables.nodeSize),
      renderLegend(
        'edge',
        'Edge colors',
        variables.edgeColor,
        summaries.edgeColor
      ),
      renderLegend('edge', 'Edge sizes', variables.edgeSize),
      renderLegend('edge', 'Edge labels', variables.edgeLabel),
    ];

    this.legendElement.innerHTML = items.filter((l) => l).join('<hr>');

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
            !this.selectedNodeCategoryValues ||
            this.selectedNodeCategoryValues.has(value)
          ) {
            span.classList.remove('evicted');
          } else {
            span.classList.add('evicted');
          }
        } else if (type === 'edge') {
          if (
            !this.selectedEdgeCategoryValues ||
            this.selectedEdgeCategoryValues.has(value)
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

        const relatedPaletteCount = (
          type === 'node' ? summaries.nodeColor : summaries.edgeColor
        ) as CategorySummary;

        this.toggleCategoryValue(type, relatedPaletteCount.palette.size, value);
        updateSpans();
        this.renderer.refresh();
      };
    });

    updateSpans();
  }

  clearSelectedItem() {
    this.selectedEdge = null;
    this.selectedNode = null;
    this.focusedNodes = null;
    this.syncHoveredNode = null;

    this.choices.setChoiceByValue('');

    if (this.model.get('clickable_edges')) {
      this.itemInfoElement.innerHTML =
        '<i>Click on a node/edge or search a node to display information about it...</i>';
    } else {
      this.itemInfoElement.innerHTML =
        '<i>Click on a node or search a node to display information about it...</i>';
    }

    this.changeInformationDisplayTab('legend');

    this.model.set('selected_node', null);
    this.model.set('selected_edge', null);
    this.touch();

    this.renderer.refresh();
    this.emitter.emit('clearSelectedItem');
  }

  toggleCategoryValue(type: ItemType, max: number, value: string) {
    let target =
      type === 'node'
        ? this.selectedNodeCategoryValues
        : this.selectedEdgeCategoryValues;

    if (!target) {
      target = new Set([value]);
    } else if (target.size === max - 1) {
      target = null;
    } else if (target.has(value)) {
      if (target.size === 1) {
        target = null;
      } else {
        target.delete(value);
      }
    } else {
      target.add(value);
    }

    const update = target ? Array.from(target) : null;

    if (type === 'node') {
      this.selectedNodeCategoryValues = target;
      this.model.set('selected_node_category_values', update);
    } else {
      this.selectedEdgeCategoryValues = target;
      this.model.set('selected_edge_category_values', update);
    }

    this.touch();
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

    this.itemInfoElement.innerHTML = innerHTML;

    this.changeInformationDisplayTab('info');

    this.renderer.refresh();
    this.emitter.emit('selectItem', { type, key });
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

    let hoveredCount = 0;

    this.renderer.on('enterNode', () => {
      hoveredCount++;
      this.container.style.cursor = 'pointer';
    });

    this.renderer.on('leaveNode', () => {
      hoveredCount--;
      if (hoveredCount === 0) this.container.style.cursor = 'default';
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
        hoveredCount++;
        this.container.style.cursor = 'pointer';
      });

      this.renderer.on('leaveEdge', () => {
        hoveredCount--;
        if (hoveredCount === 0) this.container.style.cursor = 'default';
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

    this.hideInformationButton.onclick = () => {
      this.toggleInformationDisplay();
    };

    this.showInformationButton.onclick = () => {
      this.toggleInformationDisplay();
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
      this.renderer.getCamera().animatedReset();
    };
  }

  bindFullscreenHandlers() {
    const enter =() =>{
      this.el.style.height = '100%';
      this.container.style.height = '100%';
      this.fullscreenButton.innerHTML = fullscreenExitIcon;
      this.fullscreenButton.setAttribute('title', 'exit fullscreen');
      this.renderer.scheduleRefresh();
    };

    const exit =() =>{
      const targetHeight = this.model.get('height') + 'px';
      this.el.style.height = targetHeight;
      this.container.style.height = targetHeight;
      this.fullscreenButton.innerHTML = fullscreenEnterIcon;
      this.fullscreenButton.setAttribute('title', 'enter fullscreen');
      this.renderer.scheduleRefresh();
    };

    screenfull.onchange(() => {
      if (screenfull.isFullscreen) enter();
      else exit();
    });

    this.fullscreenButton.onclick = () => {
      if (screenfull.isFullscreen) {
        screenfull.exit()
      } else {
        screenfull.request(this.el);
      }
    };
  }

  bindLayoutHandlers() {
    const graph = this.graph;
    const renderer = this.renderer;

    let settings = (this.model.get('layout_settings') ||
      {}) as ForceAtlas2Settings;
    const inferredSettings = forceAtlas2.inferSettings(graph);
    settings = Object.assign(inferredSettings, settings);

    this.layout = new LayoutSupervisor(graph, {
      settings,
      getEdgeWeight: this.edgeWeightAttribute,
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

  bindSyncEvents(syncEmitter: EventEmitter) {
    let lock = false;

    // From the broadcaster's standpoint
    const camera = this.renderer.getCamera();

    camera.on('updated', (state) => {
      if (lock) {
        lock = false;
        return;
      }

      syncEmitter.emit('camera', { state, renderer: this.renderer });
    });

    const graph = this.renderer.getGraph();

    graph.on('nodeAttributesUpdated', ({ key, attributes }) => {
      if (lock) {
        lock = false;
        return;
      }

      syncEmitter.emit('nodePosition', {
        node: key,
        position: { x: attributes.x, y: attributes.y },
        renderer: this.renderer,
      });
    });

    graph.on('eachNodeAttributesUpdated', () => {
      if (lock) {
        lock = false;
        return;
      }

      syncEmitter.emit('layout', {
        layout: collectLayout(graph),
        renderer: this.renderer,
      });
    });

    this.emitter.on('selectItem', (payload) => {
      if (lock) {
        lock = false;
        return;
      }

      syncEmitter.emit('selectItem', { ...payload, renderer: this.renderer });
    });

    this.emitter.on('clearSelectedItem', () => {
      if (lock) {
        lock = false;
        return;
      }

      syncEmitter.emit('clearSelectedItem', { renderer: this.renderer });
    });

    this.renderer.on('enterNode', ({ node }) => {
      syncEmitter.emit('enterNode', { node, renderer: this.renderer });
    });

    this.renderer.on('leaveNode', ({ node }) => {
      syncEmitter.emit('leaveNode', { node, renderer: this.renderer });
    });

    // From the receiver's end
    this.syncListeners.camera = ({ state, renderer }) => {
      if (renderer === this.renderer) return;

      lock = true;
      camera.setState(state);
    };

    this.syncListeners.layout = ({ layout, renderer }) => {
      if (renderer === this.renderer) return;

      lock = true;
      assignLayout(graph, layout);
    };

    this.syncListeners.nodePosition = ({ node, position, renderer }) => {
      if (renderer === this.renderer) return;

      lock = true;
      graph.mergeNodeAttributes(node, position);
    };

    this.syncListeners.enterNode = ({ node, renderer }) => {
      if (renderer === this.renderer) return;

      this.syncHoveredNode = node;
      this.renderer.scheduleRefresh();
    };

    this.syncListeners.leaveNode = ({ renderer }) => {
      if (renderer === this.renderer) return;

      this.syncHoveredNode = null;
      this.renderer.scheduleRefresh();
    };

    this.syncListeners.selectItem = ({ renderer, key, type }) => {
      if (renderer === this.renderer) return;

      lock = true;
      this.selectItem(type, key);
    };

    this.syncListeners.clearSelectedItem = ({ renderer }) => {
      if (renderer === this.renderer) return;

      lock = true;
      this.clearSelectedItem();
    };

    for (const eventName in this.syncListeners) {
      syncEmitter.on(eventName, this.syncListeners[eventName]);
    }
  }

  remove() {
    // Cleanup to avoid leaks and free GPU slots
    if (this.renderer) this.renderer.kill();
    if (this.layout) this.layout.kill();
    if (this.noverlap) this.noverlap.kill();

    if (this.syncKey) {
      const syncEntry = SYNC_REGISTRY.get(this.syncKey);

      if (!syncEntry) {
        throw new Error(
          'sync entry not found on remove. this should not happen!'
        );
      }

      if (syncEntry.renderers.size > 1) {
        syncEntry.renderers.delete(this.renderer);

        for (const eventName in this.syncListeners) {
          syncEntry.emitter.removeListener(
            eventName,
            this.syncListeners[eventName]
          );
        }
      } else {
        syncEntry.emitter.removeAllListeners();
        SYNC_REGISTRY.delete(this.syncKey);
      }
    }

    this.emitter.removeAllListeners();

    super.remove();
  }
}
