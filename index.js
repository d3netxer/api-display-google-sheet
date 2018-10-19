const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';



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

    const apiResult = [];

    if (rows.length) {

      console.log('Name, Major:');
      // Print columns A and E, which correspond to indices 0 and 4.

      rows.map((row) => {

          //column index for is your event part of osmgeoweek is 15
          //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
          var templateLiteralString = row[15];

          //console.log('print type templateLiteralString');
          //console.log(typeof templateLiteralString);
          //console.log(templateLiteralString);

          if (templateLiteralString) {  

              //var n = templateLiteralString.localeCompare("yes");
              //console.log('print n');
              //console.log(n);

              if (templateLiteralString == "Yes") { 
                
                //console.log('templateLiteralString equals yes');
                //console.log(templateLiteralString);
                //console.log(`${row[0]}, ${row[15]}`);

                apiResult.push({ 
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
                    "mapping_party_name"  : `${row[14]}`
                });

              }
          }
        
      });

      console.log('apiResult');
      console.log(apiResult);

      //console.log('print rows');
      //console.log(rows);

      //res.send('get events!');

      res.json(apiResult);



    } else {
      console.log('No data found.');
    }
  });
}




app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.get('/events/', function (req,res) {
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
