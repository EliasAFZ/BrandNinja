// module for making http/https requests
const request = require('request');
// module for easily parsing html
const cheerio = require('cheerio');
// module for accessing the file system
const fs = require('fs');
// module for database connection
const sqlite3 = require('sqlite3');
//module to allow direct paths to fileSize
const path = require('path');
//Module to allow electron functionality
const electron = require('electron');
//New browser window for results
const BrowserWindow = electron.remote.BrowserWindow;

//Variables for search info
var maxDepth;
var startingSite;
var keywords;
var savedName;
var savedStartingPages;
var savedKeywords;
var savedDepth;
var running;

//Variables for UI elements
const crawlNameInput = document.querySelector('.crawlNameInput');
const startUrlInput = document.querySelector('.startUrlInput');
const crawlDepthInput = document.querySelector('.crawlDepthInput');
const keywordInput = document.querySelector('.keywordInput');
const notification = document.querySelector('#message');
const status = document.querySelector('#status');
const runButton = document.querySelector('#run');
const clearButton = document.querySelector('#clear');
const toggleSwitch = document.querySelector('.theme');
const reportBtn = document.querySelector('#reportBtn');
const dbPath = path.resolve('C:\\Users\\Ansari\\Documents\\GitHub\\BrandNinja\\Searches.db');
const saveButton = document.querySelector('#history');
const loadButton = document.querySelector('#file');
const clearDBButton = document.querySelector('#clearDatabase');

/*
recursive function for crawling
 */
let visited = new Set();

function crawl(startingSite, depth) {
    if (depth < maxDepth && running) {
        console.log(running);
        getLinks(startingSite, function (sites) { //pulls all the links from a specific page and returns them as an array of strings
            for (var i = 0; i < sites.length; i++) { //for each string we got from the page
                findTarget(sites[i]); //find any of the keywords we want on the page, print out if so
                crawl(sites[i], depth + 1); //crawl all the pages on that page, and increase the depth
            }
        });
    }
}

/*
runs through a list of sites and tries to find any of the keywords
 */
function findTarget(site) {
    findInPage(keywords, site, function (containsATarget, target, url) {
        if (containsATarget && target != undefined) {
            //TODO: PRINT TO FILE
            addToWindow(url, target);
        }
    });
}

/*
returns a list of urls found on a parent url page
 */
function getLinks(parentURL, callback) {
    let url = parentURL;
    let set = new Set();
    if (url != undefined) {
        request(url, function (error, response, body) {
            if (!error) {
                var $ = cheerio.load(body);
                $('a').each(function (i, elem) {
                    if (!visited.has(elem.attribs.href)) {
                        console.log("added");
                        set.add(elem.attribs.href);
                        visited.add(elem.attribs.href);
                    }
                });
            }
            callback(Array.from(set));
        });
    }
    else {

    }
}


/*
returns true if a page contains one of the target keywords, as well as the URL it was found at, and the target itself;
 */
function findInPage(target, url, callback) {
    if (url != undefined) {
        request(url, function (error, response, body) {
            if (!error) {
                var $ = cheerio.load(body);
                var bodyText = $('html > body').text().toLowerCase();
                let htmlBodySet = new Set(bodyText.split(' '));
                var htmlBody = Array.from(htmlBodySet);
                var targets = target.toLowerCase().split(',');
                var found = false;
                var results = [];
                for (var i = 0; i < htmlBody.length; i++) {
                    var temp = htmlBody[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
                    var text = temp.replace(/\s{2,}/g, " ");
                    for (var j = 0; j < targets.length; j++) {
                        targets[j].trim();
                        if (text.localeCompare(targets[j]) === 0) {
                            found = true;
                            results.push(targets[j]);
                        }
                    }
                }
                let resultSet = new Set(results);
                let arr = Array.from(resultSet);
                arr.sort();
                return callback(found, arr.join('-'), url);
            }
        });
    }
    else {
        return callback(false, null, url);
    }
}

/*
Starts the crawl
*/
runButton.addEventListener('click', function () {
    visited.clear();
    maxDepth = parseInt(crawlDepthInput.value);
    crawlName = crawlNameInput.value; //TODO: do something with the name
    startingSite = startUrlInput.value;
    keywords = keywordInput.value;
    reportBtn.style.opacity = 0;
    run();
});

function run() {
    running = true;
    crawl(startingSite, 0);
    resultsWindow();
}

let win = null;

/*
Creates new window for search results to go on
*/
function resultsWindow() {
    win = new BrowserWindow({width: 800, height: 600});
    win.on('closed', () => {
        win = null
        running = false;
    });
    win.loadURL(`file://${__dirname}/../results.html`);
}

/*
Adds search results to the results window
*/
function addToWindow(url, matchedWord) {
    win.webContents.send('url', url + '');
    win.webContents.send('matchedWord', matchedWord + '');
}

/*
Clears the input fields
 */
clearButton.addEventListener('click', function () {
    startingSite = '';
    startUrlInput.value = '';
    maxDepth = '';
    crawlNameInput.value = '';
    keywordInput.value = '';
    crawlDepthInput.value = '';
});

/*
Button which switches theme
*/
toggleSwitch.addEventListener('click', function () {
    if (toggleSwitch.checked == false) {
        changeTheme('#4b4b4b', '#ecf0f1');
    }
    else {
        changeTheme('#ffffff', '#4b4b4b');
    }
});

/*
Changes the theme
 */
function changeTheme(background, foreground) {
    console.log('Changing theme');
    document.querySelector('body').style.backgroundColor = background;
    document.querySelector('span').style.color = foreground;
    document.querySelector('h1').style.color = foreground;
    document.querySelector('h3').style.color = foreground;
    document.querySelector('#run').style.color = foreground;
    document.querySelector('#history').style.color = foreground;
    document.querySelector('#file').style.color = foreground;
    document.querySelector('#clear').style.color = foreground;
}

/*
Saves search to database
 */
saveButton.addEventListener('click', function () {
	//Gets values from input fields
    savedName = crawlNameInput.value;
    savedStartingPages = startUrlInput.value;
    savedKeywords = keywordInput.value;
    savedDepth = crawlDepthInput.value;

    console.log(savedName + savedStartingPages + savedKeywords + savedDepth);
    var exists = fs.existsSync(dbPath);
    console.log("exists: " + exists);

	//Creates connection to database
    let db = new sqlite3.Database('dbPath', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the Searches database.');
    });

	//Adds values to the database
    db.serialize(function () {

		//Ensures table exists
        db.run("CREATE TABLE if not exists saved_searches(name TEXT, links LONGTEXT, keywords LONGTEXT, depth INT)");

		//Prepares statement
        var stmt = db.prepare("INSERT INTO saved_searches VALUES (?,?,?,?)");
		
		//Adds to table
        stmt.run(savedName, savedStartingPages, savedKeywords, savedDepth);
        stmt.finalize();

		//Prints table contents to console for debugging
        db.each("SELECT * FROM saved_searches", function (err, row) {
            console.log(row.name + ", " + row.links + ", " + row.keywords + ", " + row.depth);
        });
    });

	//Closes database connection
    db.close();

    notification.innerHTML = 'Search saved.';
});

/*
Clears all saved searches in the database
*/
clearDBButton.addEventListener('click', function() {
	//Creates connection to database
	let db = new sqlite3.Database('dbPath', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the Searches database.');
    });

	//Clears the table by dropping it
    db.serialize(function () {
        db.run("DROP TABLE saved_searches");
    });

	//Closes the database connection
    db.close();
});

/*
Opens a window with saved searches on it
 */
loadButton.addEventListener('click', function () {
    window.location.href = path.resolve(__dirname, 'searchSelection.html')
});

