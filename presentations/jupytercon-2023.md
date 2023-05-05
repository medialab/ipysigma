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

class: impact

## Visual Network Analysis

---

## A statistical approach to graphs

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