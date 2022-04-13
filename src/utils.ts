import Sigma from 'sigma';
import FileSaver from 'file-saver';
import * as gexf from 'graphology-gexf/browser';
// @ts-ignore
import renderAsSVG from 'graphology-svg/renderer';
// @ts-ignore
import { DEFAULTS as SVG_DEFAULTS } from 'graphology-svg/defaults';

// Taken and adapted from: https://github.com/jacomyal/sigma.js/blob/main/examples/png-snapshot/saveAsPNG.ts
function renderToAuxiliaryCanvas(
  renderer: Sigma,
  inputLayers?: string[]
): [HTMLCanvasElement, () => void] {
  const { width, height } = renderer.getDimensions();

  // This pixel ratio is here to deal with retina displays.
  // Indeed, for dimensions W and H, on a retina display, the canvases
  // dimensions actually are 2 * W and 2 * H. Sigma properly deals with it, but
  // we need to readapt here:
  const pixelRatio = window.devicePixelRatio || 1;

  const tmpRoot = document.createElement('DIV');
  tmpRoot.style.width = `${width}px`;
  tmpRoot.style.height = `${height}px`;
  tmpRoot.style.position = 'absolute';
  tmpRoot.style.right = '101%';
  tmpRoot.style.bottom = '101%';
  document.body.appendChild(tmpRoot);

  // Instantiate sigma:
  const tmpRenderer = new Sigma(
    renderer.getGraph(),
    tmpRoot,
    renderer.getSettings()
  );

  // Copy camera and force to render now, to avoid having to wait the schedule /
  // debounce frame:
  tmpRenderer.getCamera().setState(renderer.getCamera().getState());
  tmpRenderer.refresh();

  // Create a new canvas, on which the different layers will be drawn:
  const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
  canvas.setAttribute('width', width * pixelRatio + '');
  canvas.setAttribute('height', height * pixelRatio + '');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Draw a white background first:
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width * pixelRatio, height * pixelRatio);

  // For each layer, draw it on our canvas:
  const canvases = tmpRenderer.getCanvases();
  const layers = inputLayers
    ? inputLayers.filter((id) => !!canvases[id])
    : Object.keys(canvases);

  layers.forEach((id) => {
    ctx.drawImage(
      canvases[id],
      0,
      0,
      width * pixelRatio,
      height * pixelRatio,
      0,
      0,
      width * pixelRatio,
      height * pixelRatio
    );
  });

  return [
    canvas,
    () => {
      // Cleanup:
      tmpRenderer.kill();
      tmpRoot.remove();
    },
  ];
}

export function renderAsDataURL(renderer: Sigma): string {
  const [canvas, cleanup] = renderToAuxiliaryCanvas(renderer);

  const dataURL = canvas.toDataURL();

  cleanup();

  return dataURL;
}

export function saveAsPNG(renderer: Sigma): void {
  const [canvas, cleanup] = renderToAuxiliaryCanvas(renderer);

  // Save the canvas as a PNG image:
  canvas.toBlob((blob) => {
    if (blob) FileSaver.saveAs(blob, 'graph.png');
    cleanup();
  }, 'image/png');
}

export function saveAsJSON(renderer: Sigma): void {
  const data = JSON.stringify(renderer.getGraph(), null, 2);
  FileSaver.saveAs(
    new Blob([data], { type: 'application/json' }),
    'graph.json'
  );
}

export function saveAsGEXF(renderer: Sigma): void {
  const data = gexf.write(renderer.getGraph());
  FileSaver.saveAs(new Blob([data], { type: 'application/xml' }), 'graph.gexf');
}

export function saveAsSVG(renderer: Sigma): void {
  const rendererSettings = renderer.getSettings();

  const settings = Object.assign({}, SVG_DEFAULTS);

  settings.nodes = {
    // @ts-ignore
    reducer: (_, n, a) => rendererSettings.nodeReducer(n, a),
    defaultColor: rendererSettings.defaultNodeColor,
  };
  settings.edges = {
    // @ts-ignore
    reducer: (_, e, a) => rendererSettings.edgeReducer(e, a),
    defaultColor: rendererSettings.defaultEdgeColor,
  };

  const data = renderAsSVG(renderer.getGraph(), settings);
  FileSaver.saveAs(new Blob([data], { type: 'image/svg+xml' }), 'graph.svg');
}
