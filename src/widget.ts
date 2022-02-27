import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import Graph from 'graphology';
import { SerializedGraph } from 'graphology-types';
import LayoutSupervisor from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { Settings as SigmaSettings } from 'sigma/settings';
import seedrandom from 'seedrandom';
import type { Properties as CSSProperties } from 'csstype';
import comma from 'comma-number';
import Choices from 'choices.js';
import screenfull from 'screenfull';

import { MODULE_NAME, MODULE_VERSION } from './version';
import saveAsPNG from './saveAsPNG';

import {
  zoomIcon,
  unzoomIcon,
  resetZoomIcon,
  playIcon,
  pauseIcon,
  fullscreenEnterIcon,
  fullscreenExitIcon,
} from './icons';

import 'choices.js/public/assets/styles/choices.min.css';
import '../css/widget.css';

/**
 * Types.
 */
type RNGFunction = () => number;
type InformationDisplayTab = 'legend' | 'node-info';

/**
 * Constants.
 */
const CAMERA_OFFSET = 0.65;
const NODE_VIZ_ATTRIBUTES = new Set(['size', 'color', 'x', 'y']);

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
      <em id="ipysigma-information-node-info-button" class="ipysigma-tab-button">node info</em>
    </div>
    <hr>
    <div id="ipysigma-legend"><em>Todo: legend...</em></div>
    <div id="ipysigma-node-information"></div>
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
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAttributeValue(value: any): string {
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

  let minSize = Infinity;
  let maxSize = -Infinity;

  // Rectifications
  graph.updateEachNodeAttributes((key, attr) => {
    // Random position for nodes without positions
    if (!isValidNumber(attr.x)) attr.x = rng();
    if (!isValidNumber(attr.y)) attr.y = rng();

    // If we don't have a label we keep the key instead
    if (!attr.label) attr.label = key;

    if (attr.size) {
      if (attr.size < minSize) minSize = attr.size;
      if (attr.size > maxSize) maxSize = attr.size;
    }

    return attr;
  });

  // const hasConstantNodeSizes = minSize === Infinity || minSize === maxSize;

  return graph;
}

function selectSigmaSettings(graph: Graph): Partial<SigmaSettings> {
  const settings: Partial<SigmaSettings> = {
    zIndex: true,
  };

  if (graph.type !== 'undirected') {
    settings.defaultEdgeType = 'arrow';
  }

  return settings;
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

  layout: LayoutSupervisor;
  layoutButton: HTMLElement;
  layoutSpinner: [HTMLElement, () => void] | null = null;
  layoutControls: HTMLElement;

  zoomButton: HTMLElement;
  unzoomButton: HTMLElement;
  resetZoomButton: HTMLElement;

  fullscreenButton: HTMLElement;

  choices: Choices;
  currentTab: InformationDisplayTab = 'legend';
  nodeInfoElement: HTMLElement;
  legendElement: HTMLElement;
  legendButton: HTMLElement;
  nodeInfoButton: HTMLElement;
  selectedNode: string | null = null;
  focusedNodes: Set<string> | null = null;

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

    this.layout = new LayoutSupervisor(graph, {
      settings: forceAtlas2.inferSettings(graph),
    });

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
    ) as HTMLElement;

    // Search
    var searchContainer = this.el.querySelector(
      '#ipysigma-search'
    ) as HTMLElement;

    const options = graph.mapNodes((key, attr) => {
      return { value: key, label: attr.label };
    });

    this.choices = new Choices(searchContainer, {
      removeItemButton: true,
      renderChoiceLimit: 10,
      choices: options,
      itemSelectText: '',
      position: 'bottom',
    });

    this.nodeInfoElement = this.el.querySelector(
      '#ipysigma-node-information'
    ) as HTMLElement;
    this.legendElement = this.el.querySelector(
      '#ipysigma-legend'
    ) as HTMLElement;

    this.nodeInfoButton = this.el.querySelector(
      '#ipysigma-information-node-info-button'
    ) as HTMLElement;
    this.legendButton = this.el.querySelector(
      '#ipysigma-information-legend-button'
    ) as HTMLElement;

    this.changeInformationDisplayTab('legend');

    // Waiting for widget to be mounted to register events
    this.displayed.then(() => {
      const rendererSettings = selectSigmaSettings(graph);

      // Node reducer
      rendererSettings.nodeReducer = (node, data) => {
        const displayData = { ...data };

        if (node === this.selectedNode) {
          displayData.highlighted = true;
        }

        if (this.focusedNodes && !this.focusedNodes.has(node)) {
          displayData.color = 'lightgray';
          displayData.zIndex = 0;
          displayData.size = displayData.size ? displayData.size / 2 : 1;
        } else {
          displayData.zIndex = 1;
        }

        return displayData;
      };

      // Edge reducer
      rendererSettings.edgeReducer = (edge, data) => {
        if (!this.focusedNodes) return data;

        const [source, target] = graph.extremities(edge);

        const displayData = { ...data };

        if (!this.focusedNodes.has(source) && !this.focusedNodes.has(target)) {
          displayData.hidden = true;
        }

        return displayData;
      };

      this.renderer = new Sigma(graph, this.container, rendererSettings);
      this.renderer.getCamera().setState({ x: CAMERA_OFFSET });

      this.clearSelectedNode();

      this.bindMessageHandlers();
      this.bindRendererHandlers();
      this.bindChoicesHandlers();
      this.bindInformationDisplayHandlers();
      this.bindCameraHandlers();
      this.bindFullscreenHandlers();
      this.bindLayoutHandlers();
    });
  }

  renderSnapshot() {
    this.model.set('snapshot', saveAsPNG(this.renderer));
    this.touch();
  }

  changeInformationDisplayTab(tab: InformationDisplayTab) {
    if (tab === 'legend') {
      hide(this.nodeInfoElement);
      show(this.legendElement);
      this.legendButton.classList.remove('selectable');
      this.nodeInfoButton.classList.add('selectable');
    } else {
      hide(this.legendElement);
      show(this.nodeInfoElement);
      this.legendButton.classList.add('selectable');
      this.nodeInfoButton.classList.remove('selectable');
    }
  }

  clearSelectedNode() {
    this.selectedNode = null;
    this.focusedNodes = null;
    this.nodeInfoElement.innerHTML =
      '<i>Click on a node or search a node to display information about it...</i>';

    this.changeInformationDisplayTab('legend');

    this.renderer.refresh();
  }

  selectNode(key: string) {
    const graph = this.renderer.getGraph();

    this.selectedNode = key;
    const focusedNodes: Set<string> = new Set();

    focusedNodes.add(this.selectedNode);

    graph.forEachNeighbor(key, (neighbor) => {
      focusedNodes.add(neighbor);
    });

    this.focusedNodes = focusedNodes;

    const attr = graph.getNodeAttributes(key);

    let innerHTML = `<b>key</b> <i>${escapeHtml(
      key
    )}</i><br><b>label</b> <i>${escapeHtml(attr.label)}</i>`;

    const vizInfo: string[] = [];
    const info: string[] = [];

    for (const k in attr) {
      if (k === 'label') continue;

      const target = NODE_VIZ_ATTRIBUTES.has(k) ? vizInfo : info;

      target.push(`<b>${k}</b> ${renderAttributeValue(attr[k])}`);
    }

    if (info.length !== 0) innerHTML += '<hr>' + info.join('<br>');

    if (vizInfo.length !== 0) innerHTML += '<hr>' + vizInfo.join('<br>');

    innerHTML += '<hr>';
    innerHTML += `<b>degree</b> ${renderAttributeValue(graph.degree(key))}<br>`;

    if (graph.directedSize !== 0) {
      innerHTML += `<b>indegree</b> ${renderAttributeValue(
        graph.inDegree(key)
      )}<br>`;
      innerHTML += `<b>outdegree</b> ${renderAttributeValue(
        graph.outDegree(key)
      )}<br>`;
    }

    this.nodeInfoElement.innerHTML = innerHTML;

    this.changeInformationDisplayTab('node-info');

    this.renderer.refresh();
  }

  bindMessageHandlers() {
    this.model.on('msg:custom', (content) => {
      if (content.msg === 'render_snapshot') {
        this.renderSnapshot();
      }
    });
  }

  bindRendererHandlers() {
    this.renderer.on('enterNode', () => {
      this.container.style.cursor = 'pointer';
    });

    this.renderer.on('leaveNode', () => {
      this.container.style.cursor = 'default';
    });

    this.renderer.on('clickNode', ({ node }) => {
      if (node === this.selectedNode) return;

      this.selectNode(node);
      this.choices.setChoiceByValue(node);
    });

    this.renderer.on('clickStage', () => {
      if (!this.selectedNode) return;

      this.clearSelectedNode();
      this.choices.setChoiceByValue('');
    });
  }

  bindChoicesHandlers() {
    this.choices.passedElement.element.addEventListener(
      'change',
      (event: any) => {
        const node = event.detail.value;

        if (node === this.selectedNode) return;

        if (!node) return this.clearSelectedNode();

        this.selectNode(node);
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

      this.changeInformationDisplayTab('node-info');
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
    const stopLayout = () => {
      if (this.layoutSpinner) {
        this.layoutControls.removeChild(this.layoutSpinner[0]);
        this.layoutSpinner[1]();
        this.layoutSpinner = null;
      }
      this.layoutButton.innerHTML = playIcon;
      this.layoutButton.setAttribute('title', 'start layout');
      this.layout.stop();
    };

    const startLayout = () => {
      this.layoutSpinner = createSpinner();
      this.layoutButton.innerHTML = pauseIcon;
      this.layoutControls.appendChild(this.layoutSpinner[0]);
      this.layoutButton.setAttribute('title', 'stop layout');
      this.layout.start();
    };

    if (this.model.get('start_layout')) startLayout();

    this.layoutButton.onclick = () => {
      if (this.layout.isRunning()) {
        stopLayout();
      } else {
        startLayout();
      }
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
