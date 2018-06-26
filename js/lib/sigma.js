var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');

var Graph = require('graphology');
var WebGLRenderer = require('sigma/renderers/webgl').default;
var FA2Layout = require('graphology-layout-forceatlas2/worker');


// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

function toRGBString(element) {
  var a = element.a,
      r = element.r,
      g = element.g,
      b = element.b;

  return a ?
    ('rgba(' + r + ',' + g + ',' + b + ',' + a + ')') :
    ('rgb(' + r + ',' + g + ',' + b + ')');
}

function buildGraph(data) {
    var graph = new Graph({type: data.directed ? 'directed': 'undirected'});

    data.nodes.forEach(function(node) {
        var key = node[0];
        var attrs = node[1];

        if (!attrs.viz)
            attrs.viz = {};

        if (!attrs.x)
            attrs.x = _.get(attrs, 'viz.position.x', Math.random());
        if (!attrs.y)
            attrs.y = _.get(attrs, 'viz.position.y', Math.random());

        if (!attrs.size)
            attrs.size = _.get(attrs, 'viz.size', 2);

        if (!attrs.color)
            attrs.color = 'color' in attrs.viz ? toRGBString(attrs.viz.color) : Math.random();

        if (!attrs.label)
            attrs.label = key;

        graph.addNode(key, attrs);
    });

    data.edges.forEach(function(edge) {
        var source = edge[0];
        var target = edge[1];
        var attrs = edge[2];

        if (!attrs.viz)
            attrs.viz = {};

        if (!attrs.color)
            attrs.color = '#CCC';

        graph.addEdge(source, target, attrs);
    });

    return graph;
}

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var SigmaModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name : 'SigmaModel',
        _view_name : 'SigmaView',
        _model_module : 'ipysigma',
        _view_module : 'ipysigma',
        _model_module_version : '0.1.0',
        _view_module_version : '0.1.0'
    })
});


// Custom View. Renders the widget model.
var SigmaView = widgets.DOMWidgetView.extend({
    initialize: function() {
        this.renderSigma = this.renderSigma.bind(this);
    },

    render: function() {
        var self = this;

        var height = this.model.get('height');

        var el = this.el;
        el.style.height = height + 'px';

        var container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = height + 'px';

        el.appendChild(container);

        var layoutButton = document.createElement('button');
        layoutButton.style.position = 'absolute';
        layoutButton.style.bottom = '10px';
        layoutButton.style.right = '10px';
        layoutButton.textContent = 'Start Layout';
        layoutButton.style.zIndex = '10';

        layoutButton.onclick = function() {
            if (self.layout && self.layout.running) {
                layoutButton.textContent = 'Start Layout';
                self.layout.stop();
            }
            else {
                layoutButton.textContent = 'Stop Layout';
                self.layout.start();
            }
        };

        container.appendChild(layoutButton);

        this.container = container;

        this.dataChanged();
        this.model.on('change:value', this.dataChanged, this);
    },

    dataChanged: function() {
        var data = this.model.get('data');

        this.graph = buildGraph(data);

        var height = this.model.get('height');

        requestAnimationFrame(this.renderSigma);
    },

    renderSigma: function() {
        this.renderer = new WebGLRenderer(this.graph, this.container);
        this.layout = new FA2Layout(this.graph);
    }
});


module.exports = {
    SigmaModel : SigmaModel,
    SigmaView : SigmaView
};
