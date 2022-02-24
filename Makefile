# Commands
all: test
test: unit

clean:
	rm -rf *.egg-info
	rm -rf dist

deps:
	pip3 install build twine
	pip3 install jupyterlab
	pip3 install -e ".[test, examples]"
	npm i -g yarn

unit:
	@echo Running python tests...
	py.test
	@echo Running javascript tests...
	yarn test
	@echo

release:
	@echo Publishing on npm...
	npm publish .
	@echo Publishing on pypi...
	python -m build .
	twine check dist/*
	twine upload dist/*
	@echo
