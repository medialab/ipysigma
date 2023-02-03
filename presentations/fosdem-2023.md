title: ipysigma - a Jupyter widget for interactive visual network analysis
slug: ipysigma
class: animation-fade responsive
layout: true

<!-- This slide will serve as the base layout for all your slides -->

.bottom-bar[
  {{title}}
]

---

class: impact

# ipysigma

## a Jupyter widget for interactive visual network analysis

<hr>

_Graph devroom, FOSDEM 2023_

---

class: impact

_<s>Guillaume Plique</s> Benjamin Ooghe-Tabanou, médialab SciencesPo_

_Special thanks to ✨Laura Miguel✨ for data collection and processing_

---

class: impact

### Visual Network Analysis: why & how

---

## 1736: Leonhard Euler & the 7 Bridges of Königsberg

<center>
  <img src="img/konigsberg.png"/>
</center>

---

## 1934: Jacob Levy Moreno's sociograms

<center>
  <img src="img/moreno.jpg"/>
</center>

---

## 20th century: computer assisted layout & clustering

<center>
  <img src="img/force-spatialization.png" height="500"/>
</center>

---

## Graphs are like maps

<center>
  <img src="img/linkedin.png" height="500"/>
</center>

---

## Graphs help us navigate and locate

<center>
  <img src="img/internet-map.png" height="500"/>
</center>

---

class: impact

### A brief history of interactive tools

---

## For the desktop first, for instance [Gephi](https://gephi.org/) 

<center>
  <img src="img/gephi.png" height="520"/>
</center>

---

## Then for the web, thanks to libs like [Sigma.js](https://www.sigmajs.org/)

<center>
  <img src="img/sigma.png" height="500"/>
</center>

---

## which enabled developing Gephi-like tools for the web

Like [MiniVaN](https://medialab.github.io/minivan/), ...

<center>
  <img src="img/minivan.png" height="450"/>
</center>

---

## which enabled developing Gephi-like tools for the web

Like MiniVaN, [Nansi](https://medialab.github.io/nansi/), ...

<center>
  <img src="img/nansi.png" height="450"/>
</center>

---

## which enabled developing Gephi-like tools for the web

Like MiniVaN, Nansi, [Retina](https://ouestware.gitlab.io/retina/1.0.0-beta.1/), etc.

<center>
  <img src="img/retina.png" height="450"/>
</center>

---

class: impact

### We now have many rich interactive tools allowing us to visualize, explore and manipulate graphs.

### &nbsp;

### But...

---

class: impact

### ...all of them work with graph files (GEXF, GraphML, JSON, etc)

### &nbsp;

### What if we want to juggle between building/prototyping our graph and exploring it?

---

# We need a tool for prototyping graphs while coding and having a quick way to visualize results


