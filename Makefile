# Functions
define clean
	rm -rf *.egg-info
	rm -rf dist
endef

# Commands
all: test
test: unit

clean:
	$(call clean)

deps:
	npm i -g yarn
	pip3 install -U pip
	pip3 install build twine jupyter_packaging black
	pip3 install jupyterlab
	pip3 install networkx igraph
	pip3 install -e ".[test, examples]"
	yarn run build
	jupyter labextension develop --overwrite .
	jupyter nbextension install --sys-prefix --symlink --overwrite --py ipysigma
	jupyter nbextension enable --sys-prefix --py ipysigma

format:
	black ipysigma

unit:
	@echo Running python tests...
	py.test -svvv
	@echo Running javascript tests...
	yarn test
	@echo

release:
	$(call clean)
	yarn run build
	@echo Publishing on npm...
	npm publish .
	@echo Publishing on pypi...
	python -m build .
	twine check dist/ipysigma-*
	twine upload dist/ipysigma-*
	@echo
	$(call clean)

watch:
	@echo Watching js files...
	yarn run watch
