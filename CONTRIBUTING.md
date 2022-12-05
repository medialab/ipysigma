# Contributing to ipysigma

- [Development Installation](#development-installation)
  - [How to see your changes](#how-to-see-your-changes)
    - [Typescript](#typescript)
    - [Python](#python)
  - [How to bump version](#how-to-bump-version)
  - [How to release](#how-to-release)

## Development Installation

Be sure to have a working installation of Node.js >= 14.

Create and activate a virtual environment using conda or pyenv:

```bash
# Using pyenv
pyenv virtualenv 3.6.10 ipysigma
pyenv local ipysigma

# Using conda
conda create -n ipysigma-dev -c conda-forge nodejs yarn python jupyterlab
conda activate ipysigma-dev
```

Then run the `deps` task of the Makefile to install and build everything necessary:

```
make deps
```

### How to see your changes

#### Typescript

If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the widget.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
make watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

#### Python

If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.

### How to bump version

You need to make sure to update the version in the following files:

- `package.json`
- `package-lock.json`
- `ipysigma/_frontend.py`
- `ipysigma/_version.py`

### How to release

Run `make release`.
