var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');

var Graph = require('graphology');
var WebGLRenderer = require('sigma/renderers/webgl').default;


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

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var SigmaModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name : 'SigmaModel',
        _view_name : 'SigmaView',
        _model_module : 'ipysigma',
        _view_module : 'ipysigma',
        _model_module_version : '0.1.0',
        _view_module_version : '0.1.0',
        value : 'Hello Sigma!'
    })
});


// Custom View. Renders the widget model.
var SigmaView = widgets.DOMWidgetView.extend({
    initialize: function() {
        this.el.style.height = '500px';
        this.renderSigma = this.renderSigma.bind(this);
    },

    render: function() {
        this.value_changed();
        this.model.on('change:value', this.value_changed, this);
    },

    value_changed: function() {
        var data = this.model.get('value');

        var graph = new Graph({type: data.directed ? 'directed': 'undirected'});

        data.nodes.forEach(function(node) {
            var key = node[0];
            var attrs = node[1];

            if (!attrs.viz)
                attrs.viz = {};

            if (!attrs.x)
                attrs.x = 'x' in attrs.viz.position ? attrs.viz.position.x : Math.random();
            if (!attrs.y)
                attrs.y = 'y' in attrs.viz.position ? attrs.viz.position.y : Math.random();

            if (!attrs.size)
                attrs.size = 'size' in attrs.viz ? attrs.viz.size : Math.random();

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

        this.graph = graph;

        requestAnimationFrame(this.renderSigma);
    },

    renderSigma: function() {
        this.renderer = new WebGLRenderer(this.graph, this.el);
    }
});


module.exports = {
    SigmaModel : SigmaModel,
    SigmaView : SigmaView
};
