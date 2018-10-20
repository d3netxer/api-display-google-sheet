const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';

const MAPBOX_ClientID_PATH = 'token.json';

var geo = require('mapbox-geocoding');

const serverless = require('serverless-http');
const express = require('express')
var cors = require('cors')
const app = express()

app.use(cors())

var mainData = 10;
var rows;


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


function geocode (location) {


  return new Promise((resolve, reject) => {

        console.log("inside geocode function");
        console.log(location);
        //console.log(country);

        geo.geocode('mapbox.places', location, function (err, geoData) {
                      //console.log(geoData.features[0].center[0]);
                      //console.log(geoData.features[0].center[1]);

                      //console.log('api result about to get pushed')
                      //console.log(apiResult);
                      lat =  geoData.features[0].center[0].toString() ;
                      lon =  geoData.features[0].center[1].toString() ;
                      //apiEntry.push("lon"  : geoData.features[0].center[1].toString());
                      //console.log('apiEntry');
                      //console.log(apiEntry);

                      resolve([lat,lon]);

                      //console.log('apiResult before push');
                      //console.log(apiResult);

                      //apiResult.push(apiEntry);

                      
          });



    })



}


/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */

function listMajors(auth,req,res) {

  const sheets = google.sheets({version: 'v4', auth});
  sheets.spreadsheets.values.get({
    //spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    spreadsheetId: '1bCgCA-YJxcH9SVkPIEtHnjaIZaAZgnSaf9epuHkfmF4',
    range: 'A2:Q',
  }, (err, result) => {
      if (err) return console.log('The API returned an error: ' + err);

      const rows = result.data.values;

      var apiResult = [];

      if (rows.length) {

        //console.log('Name, Major:');
        // Print columns A and E, which correspond to indices 0 and 4.

        //keep only rows that are part of OSMGeoWeek
        var geoweekRows = [] 

        var i;
        for (i = 0; i < rows.length; i++) { 
            var templateLiteralString = rows[i][15];
            if (templateLiteralString) {  
              if (templateLiteralString == "Yes") { 
                geoweekRows.push(rows[i]);
              }
            }
        }

        console.log('print geoweekRows length');
        console.log(geoweekRows.length);

        let promises = geoweekRows.map(row => {
          return geocode(`${row[4]},${row[5]}`)
          //return geocode("sterling","virginia")
            .then(function(result) {
              console.log('print result');
              console.log(result);
              //console.log(lat);
              //console.log(lon);
              //return 'lat';


              var apiEntry = {
                    "timestamp" : `${row[0]}`,
                    "org_name"  : `${row[3]}`,
                    "location"  : `${row[4]}`,
                    "country"  : `${row[5]}`,
                    "date"  : `${row[6]}`,
                    "start_time"  : `${row[7]}`,
                    "end_time"  : `${row[8]}`,
                    "sign_up_link"  : `${row[10]}`,
                    "venue_name"  : `${row[12]}`,
                    "osm_link"  : `${row[13]}`,
                    "mapping_party_name"  : `${row[14]}`,
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
            console.log('apiResult after Promise all');
            console.log(apiResult);

            res.json(apiResult);
          })
          .catch(e => {
            console.error(e);
          })

      //console.log('geocoder test');
      // Geocode an address to coordinates
      /*
      geo.geocode('mapbox.places', 'Dam Square, Amsterdam', function (err, geoData) {
        console.log(geoData.features[0].center);
      });
      */

      

    } else {
      console.log('No data found.');
    }
  });

}


app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.get('/events/', function (req,res) {

  //load MapBox access token
  fs.readFile('mapbox_client_id.json', (err, content) => {
    if (err) return console.log('need a config.json file with MapBox ClientID Token');
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
    authorize(JSON.parse(content), listMajors, req, res);
  });

})

module.exports.handler = serverless(app);
