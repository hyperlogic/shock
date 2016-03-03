shock-ac-min.js: js/shock-ac.js
	rm -rf shock-ac-min.js
	jshint js/*.js
	browserify js/shock-ac.js -o shock-ac-min.js
	chmod -w shock-ac-min.js

clean:
	rm -rf shock-ac-min.js
