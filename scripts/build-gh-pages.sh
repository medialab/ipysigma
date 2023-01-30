set -e

DIST=$(realpath ./presentations/gh-pages)

echo "Building in $DIST"
rm -rf $DIST
mkdir $DIST

echo "Exporting decks"
cd ./presentations
mkdir $DIST/presentations
bs export -o $DIST/presentations
cd ..

echo "Copying demo"
cp -R ./docs/demo $DIST/demo

echo "Done"
