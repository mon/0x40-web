JS=HuesCanvas.js HuesCore.js HuesSettings.js HuesUI.js ResourceManager.js ResourcePack.js SoundManager.js
YUI=yuicompressor-2.4.8.jar

all: minify pack

minify:
	cd ./js ; java -jar ../compiler.jar --js $(JS) --js_output_file hues-min.js
	-rm ./css/hues-min.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-s-min.css hues-h.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-m-min.css hues-m.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-r-min.css hues-r.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-w-min.css hues-w.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-x-min.css hues-x.css
	cd ./css ; java -jar ../$(YUI) --type css -o hues-res-min.css hues-res.css
	cd ./css ; java -jar ../$(YUI) --type css -o style-min.css style.css
	cat ./css/*-min.css >> hues-min.css
	cat ./css/font-awesome.min.css >> hues-min.css
	rm ./css/*-min.css
	mv ./hues-min.css ./css/
	
pack:
	mkdir -p release
	cp index-min.html release/index.html
	cp favicon.ico release/
	mkdir -p release/js
	mkdir -p release/css
	mkdir -p release/fonts
	mkdir -p release/respacks
	cp -r respacks release/
	cp -r img release/
	cp -r fonts release/
	cp -r js/lib release/js
	cp js/hues-min.js release/js
	cp css/hues-min.css release/css