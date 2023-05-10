title: Visual Network Analysis from the comfort of your Jupyter notebook
slug: jupytercon-2023
class: animation-fade responsive
layout: true

<!-- This slide will serve as the base layout for all your slides -->

.bottom-bar[
  {{title}}
]

---

class: impact

## {{title}}

⁂

_Guillaume Plique, médialab SciencesPo_

_Jupytercon 2023_

---

## Who am I?

A **research engineer** working for [SciencesPo's médialab](medialab.sciencespo.fr/).

A **social sciences** laboratory founded by Bruno Latour 10 years ago.

We intend to mix:

* Social sciences
* Design
* Engineering

---

## What is a graph/network

Nodes/vertices, edges/links and the attached metadata.

<br>

<center>
  <img src="img/koenigsberg-graph.png"/>
</center>

---

class: impact

## Visual Network Analysis

---

## Prelude: a statistical approach to graphs

* Diameter
* Density
* Degree distribution
* Shortest paths
* Centrality
* Eigenvalues
* Linear algebra (a graph is a matrix, a matrix is a graph)
* Laplacian matrix
* Pagerank
* Amphibolic metempsychosis of the Eulerian principles
* etc.

---

## Should we try vizualizing graphs instead?

<br>

<center>
  <img src="img/koenigsberg.png"/>
</center>

---

## Should we try vizualizing graphs instead?

<br>
<br>

<center>
  <img src="img/koenigsberg-graph.png"/>
</center>

---

class: impact

## Visual Network Analysis in Social Sciences

---

## Moreno's sociograms

<table>
  <thead>
    <tr>
      <th>id</th>
      <th>Student</th>
      <th>First choice</th>
      <th>Second choice</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Amélie</td>
      <td>4</td>
      <td>3</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Jean</td>
      <td>1</td>
      <td>3</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Kareem</td>
      <td>2</td>
      <td>26</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Lydia</td>
      <td>45</td>
      <td>12</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Michael</td>
      <td>7</td>
      <td>28</td>
    </tr>
    <tr>
      <td>6</td>
      <td>Guillaume</td>
      <td>18</td>
      <td>3</td>
    </tr>
    <tr>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
  </tbody>
</table>

---

## Moreno's sociograms

<center>
  <img src="img/moreno.jpg"/>
</center>

---

## Bertin's visual variables

<center>
  <img src="img/visual-variables.png"/>
</center>

---

## Fast forward: community detection, spatial layout etc.

<center>
  <img src="img/force-spatialization.png" height="500"/>
</center>

---

class: impact

## Visual Network Analysis on desktop and on the web

???

Social science researchers were not used to program. Desktop apps were a de facto requirement.

---

## Pajek

<br>

<center>
  <img src="img/pajek.png" height="400"/>
</center>

---

## Gephi

<br>

<center>
  <img src="img/gephi.png" height="400"/>
</center>

---

## Sigma

<br>

<center>
  <img src="img/sigma.png" height="400"/>
</center>

---

## MiniVaN

<br>

<center>
  <img src="img/minivan.png" height="400"/>
</center>

---

## Nansi

<br>

<center>
  <img src="img/nansi.png" height="400"/>
</center>

---

## Retina

<br>

<center>
  <img src="img/retina.png" height="400"/>
</center>

---

## Gephi Lite

<br>

<center>
  <img src="img/gephi-lite.png" height="400"/>
</center>

---

class: impact

## Designing an app for us, social sciences data engineers

---

## The iterative process

<br>

<center>
  <img src="img/iterative-process.png" height="300px"/>
</center>

---

## Designing Nansi

Two conflicting objectives:

1. A better tool for teaching students
2. Suiting our own data processing/exploration/analysis process

<br>

<center>⁂</center>

It was *doomed* from the start.

---

class: impact

## Why don't we perform Visual Network Analysis directly in a Jupyter notebook then?

---

## Introducing ipysigma

```
pip install jupyterlab
pip install networkx # or igraph
pip install ipysigma
```

<center>
  <img src="img/interactive-exploration.gif" height="300px"/>
</center>

---

class: impact

## (Hopefully working) Demo time!

---

## A treasure trove of visual variables

* **node**
  * color, saturation
  * size
  * label, label size, label color, label font
  * border size, border ratio, border color
  * pictogram, pictogram color, shape
  * halo size, halo color
* **edge**
  * color
  * type
  * size
  * curveness
  * label

---

## Small multiples

<br>

<center>
  <img src="img/grid.gif" height="400px"/>
</center>

---

## Static embeds

<iframe src="https://medialab.github.io/ipysigma/demo.html" width="100%" height="450px" style="border: none"></iframe>

---

## Future directions

* Specialized representations such as:
  * Temporal graphs
  * Bipartite graphs
  * etc.

* Better support for various incarnations of Jupyter:
  * notebook
  * lab
  * colab
  * vscode
  * etc.

---

## Difficulties of developing custom widgets

* The documentation is a bit all around the place
* A lot of different version of `ipywidgets` etc. have to coexist
* Can be tedious to switch from the python/javascript contexts
* A lot of trial and error
* Annoying warnings in the console I cannot find a way to suppress :(

---

# Thank you for listening!

<center>
  <img src="img/pretty.png" height="500"/>
</center>
