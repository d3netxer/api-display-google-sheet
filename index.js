const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
var cors = require('cors')
const app = express()

app.use(cors())

// This is set in the serverless.yml within the Provider then environment section
const LOCATION_TABLE = process.env.LOCATION_TABLE;

let dynamoDb;

app.use(bodyParser.json({ strict: false }));

// The serverless-offline plugin sets an environment variable of IS_OFFLINE to true
const IS_OFFLINE = process.env.IS_OFFLINE;

if (IS_OFFLINE === 'true') {
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  })
  console.log(dynamoDb);
} else {
  dynamoDb = new AWS.DynamoDB.DocumentClient();
};


// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

const MAPBOX_ClientID_PATH = 'token.json';
var geo = require('mapbox-geocoding');



// This app uses code from Google Node.js Quickstart
// https://developers.google.com/sheets/api/quickstart/nodejs

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, req, res) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    console.log('before callback');
    //console.log(res);
    callback(oAuth2Client,req,res);
  });

}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}



function geocode(timestamp, place_country) {

  return new Promise((resolve, reject) => {

        //console.log('print only Timestamp');
        //console.log(timestamp);
        
        //console.log('print only place_country');
        //console.log(place_country);
        
        const params = {
            TableName: LOCATION_TABLE,
            Key: {
              timestamp: timestamp,
            },
          }
          
          dynamoDb.get(params, (error, result) => {
            if (error) {
              console.log(error);
              console.log("Could not get location");
            }
            if (result.Item) {
              const {timestamp, lat, lon} = result.Item;
              //res.json({ timestamp, lat, lon });
              //check if there is a match with timestamp and return lat and lon
              console.log('resolving lat and lon');
              resolve([lat,lon])
            } else {
              //else geocode and store in DynamoDB location table, and then return lat and lon
              console.log("location not found");
              
              geo.geocode('mapbox.places', place_country, function (err, geoData) {


                  if (geoData === undefined) {
                      console.log("geoData is undefined");
                      console.log("inside geocode function");
                      console.log('place_country');
                      console.log(place_country);
                      // if undefined give coords in the middle of the Atlantic Ocean
                      lat = 27.034013
                      lon = -43.451320
                  } else {
                      lat =  geoData.features[0].center[1].toString();
                      lon =  geoData.features[0].center[0].toString();
                  }


                  // store in DynamoDB Table
                  const params = {
                    TableName: LOCATION_TABLE,
                    Item: {
                      timestamp: timestamp,
                      lat: lat,
                      lon: lon
                    },
                  };

                  dynamoDb.put(params, (error) => {
                    if (error) {
                      console.log(error);
                      console.log('Could not create location');
                    }
                    console.log("saved location in DynamoDB table");
                  });
                    
                  resolve([lat,lon]);
              });
              
            }
          });
        
        

    })
}


function escapeUnicode(str) {
    return str.replace(/é/g, "e").replace(/š/g, "s").replace(/ě/g, "e").replace(/ü/g, "u").replace(/Ž/g, "Z")
}


/**
 * Processes the columns in a spreadsheet
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */

function processSheet(auth,req,res) {


  const sheets = google.sheets({version: 'v4', auth});
  sheets.spreadsheets.values.get({
    //sample spreadsheet: spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    spreadsheetId: '14MaSKvz7WmTS0mrj_hystgtQSgkDUvgVJruT4lnbY_U',
    range: 'A56:M',
  }, (err, result) => {
      if (err) return console.log('The API returned an error: ' + err);

      const rows = result.data.values;

      console.log('print rows');
      
      //The column that asks if event is part of OSMGeoWeek is column k, or the 10th column
      console.log(rows[0][10]);
      console.log(rows[1][10]);
      //console.log(rows);


      var apiResult = [];

      if (rows.length) {

        //keep only rows that are part of OSMGeoWeek
        var geoweekRows = [] 

        var i;
        for (i = 0; i < rows.length; i++) { 
            var templateLiteralString = rows[i][10];
            if (templateLiteralString) {  
              if (templateLiteralString == "Yes") { 
                geoweekRows.push(rows[i]);
              }
            }
        }

        //console.log('print geoweekRows length1');
        //console.log(geoweekRows.length);

        //get rid of special characters for locations
        for (var i = 0; i < geoweekRows.length; i++) {
            //console.log(geoweekRows[i][4]);
            geoweekRows[i][4] = escapeUnicode(geoweekRows[i][4]);
            //console.log(geoweekRows[i][4]);
        }

        let promises = geoweekRows.map(row => {
            
          return geocode(`${row[0]}`,`${row[3]},${row[9]}`)
          //return geocode("sterling","virginia")
            .then(function(result) {
              //console.log('print result1');
              //console.log(geoweekRows[4]);
              //console.log(result);
              //console.log(lat);
              //console.log(lon);
              //return 'lat';

              var apiEntry = {
                    "timestamp" : `${row[0]}`,
                    "event_name"  : `${row[2]}`,
                    "location"  : `${row[3]}`,
                    "country"  : `${row[9]}`,
                    "date"  : `${row[6]}`,
                    "start_time"  : `${row[7]}`,
                    "end_time"  : `${row[8]}`,
                    "sign_up_link"  : `${row[5]}`,
                    "lat"  : result[1].toString(),
                    "lon"  : result[0].toString()
                }

              //console.log('print apiEntry');
              //console.log(apiEntry);

              apiResult.push(apiEntry);

            })

      });


        // Wait for all Promises to complete
        Promise.all(promises)
          .then(results => {
            // Handle results
            //console.log('apiResult after Promise all');
            //console.log(apiResult);

            res.json(apiResult);
          })
          .catch(e => {
            console.error(e);
          })

    } else {
      console.log('No data found.');
    }
  });

}


function processSheetGeoJSON(auth,req,res) {

  console.log('inside processSheet');

  const sheets = google.sheets({version: 'v4', auth});
  sheets.spreadsheets.values.get({
    //sample spreadsheet: spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    spreadsheetId: '14MaSKvz7WmTS0mrj_hystgtQSgkDUvgVJruT4lnbY_U',
    range: 'A56:M',
  }, (err, result) => {
      if (err) return console.log('The API returned an error: ' + err);

      const rows = result.data.values;

      //console.log('print rows');
      //console.log(rows);

      var apiGeoJSONResult = {};
      apiGeoJSONResult['type'] = 'FeatureCollection';
      apiGeoJSONResult['features'] = [];
      

      if (rows.length) {

        //keep only rows that are part of OSMGeoWeek
        var geoweekRows = [] 

        var i;
        for (i = 0; i < rows.length; i++) { 
            var templateLiteralString = rows[i][10];
            if (templateLiteralString) {  
              if (templateLiteralString == "Yes") { 
                geoweekRows.push(rows[i]);
              }
            }
        }

        //get rid of special characters for locations
        for (var i = 0; i < geoweekRows.length; i++) {
            //console.log(geoweekRows[i][4]);
            geoweekRows[i][3] = escapeUnicode(geoweekRows[i][3]);
            //console.log(geoweekRows[i][4]);
        }

        //console.log('print geoweekRows length2');
        //console.log(geoweekRows.length);

        let promises = geoweekRows.map(row => {
          return geocode(`${row[0]}`,`${row[3]},${row[9]}`)
          //return geocode("sterling","virginia")
            .then(function(result) {
              //console.log('print result2');
              //console.log(result);
              //console.log(lat);
              //console.log(lon);
              //return 'lat';

              var newFeature = 
                  {
                    "type": "Feature",
                    "geometry": {
                      "type": "Point",
                      "coordinates": [result[1].toString(), result[0].toString()]
                    },
                    "properties": {
                        "timestamp" : `${row[0]}`,
                        "event_name"  : `${row[2]}`,
                        "location"  : `${row[3]}`,
                        "country"  : `${row[9]}`,
                        "date"  : `${row[6]}`,
                        "start_time"  : `${row[7]}`,
                        "end_time"  : `${row[8]}`,
                        "sign_up_link"  : `${row[5]}`
                    }
                  }


                    
                    
              //console.log('print apiEntry');
              //console.log(apiEntry);

              //apiResult.push(apiEntry);
              apiGeoJSONResult['features'].push(newFeature);

            })

      });


        // Wait for all Promises to complete
        Promise.all(promises)
          .then(results => {
            // Handle results
            console.log('apiResult after Promise all');
            console.log(apiGeoJSONResult);

            res.json(apiGeoJSONResult);
          })
          .catch(e => {
            console.error(e);
          })

    } else {
      console.log('No data found.');
    }
  });

}



app.get('/', function (req, res) {
  res.send('Hello World!')
})

// Get location endpoint
app.get('/location/:timestamp', function (req, res) {
  const params = {
    TableName: LOCATION_TABLE,
    Key: {
      timestamp: req.params.timestamp,
    },
  }
  dynamoDb.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get location' });
    }
    if (result.Item) {
      const {timestamp, lat, lon} = result.Item;
      res.json({ timestamp, lat, lon });
    } else {
      res.status(404).json({ error: "location not found" });
    }
  });
})

// Create location endpoint, used for local testing
/*
app.post('/location', function (req, res) {
  const { timestamp, lat, lon } = req.body;
  
  console.log('print timestamp');
  console.log(timestamp);
  console.log('print lat');
  console.log(lat);
  console.log('print lon');
  console.log(lon);

  if (typeof timestamp !== 'string') {
    res.status(400).json({ error: '"timestamp" must be a string' });
  } else if (typeof lat !== 'string') {
    res.status(400).json({ error: '"lat" must be a string' });
  } else if (typeof lon !== 'string') {
    res.status(400).json({ error: '"lon" must be a string' });
  }
  

  const params = {
    TableName: LOCATION_TABLE,
    Item: {
      timestamp: timestamp,
      lat: lat,
      lon: lon
    },
  };


  dynamoDb.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create location' });
    }
    res.json({ timestamp, lat, lon });
  });

})
*/


app.get('/events/', function (req,res) {

  //load google_sheet_id
  fs.readFile('google_sheet_id.json', (err, content) => {
    if (err) return console.log('need a google_sheet_id.json config file with google sheet id');
    console.log('print content');
    console.log(JSON.parse(content).google_sheet_id);
    var google_sheet_id = JSON.parse(content).google_sheet_id;
    console.log('loaded Google Sheet ID');
  });

  //load Google Sheet ID
  fs.readFile('mapbox_access_token.json', (err, content) => {
    if (err) return console.log('need a mapbox_access_token.json config file with MapBox ClientID Token');
    //console.log('print content');
    //console.log(JSON.parse(content).access_token);
    var mapbox_access_token = JSON.parse(content).access_token;
    geo.setAccessToken(mapbox_access_token);
    console.log('loaded MapBox ClientID Token');
  });

  // Load client secrets from a local file.
  //https://stackoverflow.com/questions/10058814/get-data-from-fs-readfile
  //function you have defined is an asynchronous callback. It doesn't execute right away, rather it executes when the file loading has completed. When you call readFile, control is returned immediately and the next line of code is executed.
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), processSheet, req, res);
  });

})



app.get('/events_geojson/', function (req,res) {

  //load google_sheet_id
  fs.readFile('google_sheet_id.json', (err, content) => {
    if (err) return console.log('need a google_sheet_id.json config file with google sheet id');
    console.log('print content');
    console.log(JSON.parse(content).google_sheet_id);
    var google_sheet_id = JSON.parse(content).google_sheet_id;
    console.log('loaded Google Sheet ID');
  });

  //load Google Sheet ID
  fs.readFile('mapbox_access_token.json', (err, content) => {
    if (err) return console.log('need a mapbox_access_token.json config file with MapBox ClientID Token');
    //console.log('print content');
    //console.log(JSON.parse(content).access_token);
    var mapbox_access_token = JSON.parse(content).access_token;
    geo.setAccessToken(mapbox_access_token);
    console.log('loaded MapBox ClientID Token');
  });

  // Load client secrets from a local file.
  //https://stackoverflow.com/questions/10058814/get-data-from-fs-readfile
  //function you have defined is an asynchronous callback. It doesn't execute right away, rather it executes when the file loading has completed. When you call readFile, control is returned immediately and the next line of code is executed.
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), processSheetGeoJSON, req, res);
  });

})

module.exports.handler = serverless(app);
